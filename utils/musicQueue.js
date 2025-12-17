const { createAudioPlayer, createAudioResource, joinVoiceChannel, AudioPlayerStatus, VoiceConnectionStatus, StreamType, entersState } = require('@discordjs/voice');
const YTDlpWrap = require('yt-dlp-wrap').default;
const path = require('path');
const { QUEUE, AUDIO, FFMPEG, YTDLP, MESSAGES } = require('./constants');
const ytdlp = new YTDlpWrap('yt-dlp'); // Use system yt-dlp on Linux

class MusicQueue {
    constructor(guildId) {
        this.guildId = guildId;
        this.songs = [];
        this.isPlaying = false;
        this.connection = null;
        this.player = createAudioPlayer();
        this.currentSong = null;
        this.inactivityTimeout = null;
        this.waitingForNext = false;
        this.currentFfmpeg = null;
        this.isProcessingNext = false;
        this.isConnecting = false;
        this.retryCount = 0;
        this.maxRetries = QUEUE.MAX_RETRIES;
        this.retriedSongs = new Set();

        // Set up player event listeners
        this.player.on(AudioPlayerStatus.Idle, () => {
            console.log(`[MUSIC] Player idle in guild ${this.guildId}`);
            if (!this.waitingForNext) {
                this.waitingForNext = true;
                setTimeout(() => this.playNext(), 1000);
            }
        });

        this.player.on(AudioPlayerStatus.Playing, () => {
            console.log(`[MUSIC] Player started playing in guild ${this.guildId}`);
            this.waitingForNext = false;
        });

        this.player.on('error', error => {
            console.error(`[ERROR] Audio player error in guild ${this.guildId}:`, error);
            this.waitingForNext = false;
            this.isProcessingNext = false;
            // Let the Idle event handle playing next song
            this.player.stop();
        });
    }

    clearInactivityTimeout() {
        if (this.inactivityTimeout) {
            clearTimeout(this.inactivityTimeout);
            this.inactivityTimeout = null;
        }
    }

    startInactivityTimeout() {
        this.clearInactivityTimeout();
        this.inactivityTimeout = setTimeout(() => {
            console.log(`[MUSIC] Inactivity timeout reached in guild ${this.guildId}. Disconnecting.`);
            this.stop();
        }, QUEUE.INACTIVITY_TIMEOUT_MS);
    }

    addSong(song) {
        if (this.songs.length >= QUEUE.MAX_SIZE) {
            throw new Error(MESSAGES.QUEUE_FULL(QUEUE.MAX_SIZE));
        }

        this.songs.push(song);
        console.log(`[MUSIC] Added song to queue in guild ${this.guildId}: ${song.title}, Queue length: ${this.songs.length}`);
        this.clearInactivityTimeout();
        return this.songs.length;
    }

    async play(voiceChannel) {
        console.log(`[MUSIC] Play called for guild ${this.guildId}, channel ${voiceChannel.name}`);

        try {
            // If we already have a connection to the SAME channel, skip connection setup
            // This is the critical guard that prevents disconnect/reconnect race conditions
            if (this.connection && this.connection.joinConfig.channelId === voiceChannel.id) {
                console.log(`[MUSIC] Already connected to channel in guild ${this.guildId}, skipping connection setup`);

                // If idle with songs in queue, start playback
                if (!this.isPlaying && this.songs.length > 0 && !this.isProcessingNext) {
                    console.log(`[MUSIC] Connection exists but idle, starting playback`);
                    await this.playNext();
                    return true;
                }

                return false;
            }

            // If connection exists but user is in a different channel, move the bot
            if (this.connection && this.connection.joinConfig.channelId !== voiceChannel.id) {
                console.log(`[MUSIC] Switching channels in guild ${this.guildId}`);

                // Save the current queue (which includes the newly requested song)
                const savedQueue = [...this.songs];

                // Kill ffmpeg if running
                if (this.currentFfmpeg && !this.currentFfmpeg.killed) {
                    try {
                        this.currentFfmpeg.kill('SIGKILL');
                        this.currentFfmpeg = null;
                    } catch (error) {
                        console.error(`[ERROR] Error killing ffmpeg during channel switch:`, error);
                        this.currentFfmpeg = null;
                    }
                }

                // Destroy old connection (this will trigger player cleanup automatically)
                this.connection.destroy();
                this.connection = null;

                // Create fresh player to avoid race conditions with old event listeners
                if (this.player) {
                    this.player.removeAllListeners();
                }
                this.player = createAudioPlayer();

                // Re-attach player event listeners
                this.player.on(AudioPlayerStatus.Idle, () => {
                    console.log(`[MUSIC] Player idle in guild ${this.guildId}`);
                    if (!this.waitingForNext) {
                        this.waitingForNext = true;
                        setTimeout(() => this.playNext(), 1000);
                    }
                });

                this.player.on(AudioPlayerStatus.Playing, () => {
                    console.log(`[MUSIC] Player started playing in guild ${this.guildId}`);
                    this.waitingForNext = false;
                });

                this.player.on('error', error => {
                    console.error(`[ERROR] Audio player error in guild ${this.guildId}:`, error);
                    this.waitingForNext = false;
                    this.isProcessingNext = false;
                    this.player.stop();
                });

                // Reset ALL state flags
                this.currentSong = null;
                this.isPlaying = false;
                this.waitingForNext = false;
                this.isProcessingNext = false;
                this.isConnecting = false;
                this.retryCount = 0;
                this.retriedSongs.clear();

                // Restore queue (keeps the new song that was just added)
                this.songs = savedQueue;
                console.log(`[MUSIC] Moved to new channel with fresh player, keeping ${this.songs.length} song(s) in queue`);

                // Small delay to ensure cleanup is complete
                await new Promise(resolve => setTimeout(resolve, 500));
            }

            // Create new connection if needed
            if (!this.connection && !this.isConnecting) {
                console.log(`[MUSIC] Creating voice connection for guild ${this.guildId}, channel ${voiceChannel.id}`);
                this.isConnecting = true;

                try {
                    this.connection = joinVoiceChannel({
                        channelId: voiceChannel.id,
                        guildId: voiceChannel.guild.id,
                        adapterCreator: voiceChannel.guild.voiceAdapterCreator,
                        selfDeaf: false,
                        selfMute: false,
                    });

                    // Handle connection events
                    this.connection.once(VoiceConnectionStatus.Ready, () => {
                        console.log(`[MUSIC] Voice connection ready for guild ${this.guildId}`);
                    });

                    this.connection.on(VoiceConnectionStatus.Disconnected, async () => {
                        console.log(`[MUSIC] Voice connection disconnected for guild ${this.guildId}`);
                        // Give it a short time to reconnect automatically
                        try {
                            await Promise.race([
                                entersState(this.connection, VoiceConnectionStatus.Signalling, 5_000),
                                entersState(this.connection, VoiceConnectionStatus.Connecting, 5_000),
                            ]);
                            console.log(`[MUSIC] Connection recovering for guild ${this.guildId}`);
                        } catch (error) {
                            // If it can't reconnect, destroy it cleanly
                            console.log(`[MUSIC] Could not reconnect, destroying connection for guild ${this.guildId}`);
                            if (this.connection) {
                                this.connection.destroy();
                            }
                        }
                    });

                    this.connection.on(VoiceConnectionStatus.Destroyed, () => {
                        console.log(`[MUSIC] Voice connection destroyed for guild ${this.guildId}`);
                        this.connection = null;
                        this.isConnecting = false;

                        // Stop playback and clean up when connection is destroyed
                        if (this.player) {
                            this.player.stop();
                        }

                        // Kill ffmpeg if running
                        if (this.currentFfmpeg && !this.currentFfmpeg.killed) {
                            try {
                                this.currentFfmpeg.kill('SIGKILL');
                                this.currentFfmpeg = null;
                            } catch (error) {
                                // Force null even if kill fails
                                this.currentFfmpeg = null;
                            }
                        }

                        this.isPlaying = false;
                        this.isProcessingNext = false;
                        this.waitingForNext = false;
                    });

                    this.connection.on('error', (error) => {
                        console.error(`[ERROR] Voice connection error for guild ${this.guildId}:`, error);
                        // Don't destroy connection immediately - let disconnect handler try to recover
                    });

                    // Wait for connection to be ready
                    try {
                        await entersState(this.connection, VoiceConnectionStatus.Ready, 10_000);
                        console.log(`[MUSIC] Connection ready confirmed for guild ${this.guildId}`);
                    } catch (error) {
                        console.error(`[ERROR] Connection timeout for guild ${this.guildId}:`, error);
                        this.isConnecting = false;
                        // Clean up failed connection
                        if (this.connection) {
                            this.connection.destroy();
                            this.connection = null;
                        }
                        throw error;
                    }

                    // Subscribe the player to the connection
                    this.connection.subscribe(this.player);
                    console.log(`[MUSIC] Player subscribed to connection for guild ${this.guildId}`);
                    this.isConnecting = false;
                } catch (error) {
                    console.error(`[ERROR] Failed to create voice connection for guild ${this.guildId}:`, error);
                    this.isConnecting = false;
                    if (this.connection) {
                        this.connection.destroy();
                        this.connection = null;
                    }
                    throw error;
                }
            }

            // Start playing if not already playing and we have songs
            if (!this.isPlaying && this.songs.length > 0) {
                console.log(`[MUSIC] Starting playback for guild ${this.guildId}`);
                await this.playNext();
                return true;
            }

            return false;
        } catch (error) {
            console.error(`[ERROR] Error in play method for guild ${this.guildId}:`, error);
            throw error;
        }
    }

    async playNext() {
        console.log(`[MUSIC] playNext called for guild ${this.guildId}, songs in queue: ${this.songs.length}`);

        // Prevent concurrent execution
        if (this.isProcessingNext) {
            console.log(`[MUSIC] Already processing next song for guild ${this.guildId}, skipping`);
            return;
        }

        this.isProcessingNext = true;
        this.waitingForNext = false;

        if (this.songs.length === 0) {
            console.log(`[MUSIC] No more songs in queue for guild ${this.guildId}`);
            this.isPlaying = false;
            this.currentSong = null;
            this.isProcessingNext = false;
            this.startInactivityTimeout();
            return;
        }

        try {
            this.currentSong = this.songs.shift();
            this.isPlaying = true;
            this.clearInactivityTimeout(); // Clear timeout when starting new song

            console.log(`[MUSIC] Preparing to play: ${this.currentSong.title} in guild ${this.guildId}`);
            console.log(`[MUSIC] URL: ${this.currentSong.url}`);

            // Get direct audio URL using yt-dlp
            let audioUrl;
            try {
                audioUrl = await ytdlp.execPromise([
                    this.currentSong.url,
                    '-f', YTDLP.FORMAT,
                    ...YTDLP.FLAGS
                ]);
            } catch (ytdlpError) {
                console.error(`[ERROR] YT-DLP failed to get audio URL:`, ytdlpError);
                throw new Error(`Failed to fetch audio URL: ${ytdlpError.message}`);
            }

            const directUrl = audioUrl.trim();
            if (!directUrl || !directUrl.startsWith('http')) {
                throw new Error('YT-DLP returned invalid URL');
            }
            console.log(`[MUSIC] Got direct audio URL: ${directUrl.substring(0, 100)}...`);

            // Stream the direct URL with ffmpeg
            const { spawn } = require('child_process');
            const ffmpegPath = 'ffmpeg'; // Use system ffmpeg on Linux

            // Build FFmpeg arguments with optional loudness normalization
            const ffmpegArgs = [
                '-reconnect', FFMPEG.RECONNECT,
                '-reconnect_streamed', FFMPEG.RECONNECT_STREAMED,
                '-reconnect_delay_max', FFMPEG.RECONNECT_DELAY_MAX,
                '-i', directUrl,
                '-analyzeduration', FFMPEG.ANALYZE_DURATION,
                '-loglevel', FFMPEG.LOG_LEVEL,
            ];

            // Add loudness normalization filter if enabled
            // Use different filters based on video length to optimize performance
            const TWO_HOURS = 7200;
            if (AUDIO.NORMALIZATION.ENABLED) {
                if (this.currentSong.duration < TWO_HOURS) {
                    // Short videos: Use loudnorm (accurate, high quality)
                    const { TARGET_LUFS, TARGET_LRA, TARGET_TP } = AUDIO.NORMALIZATION;
                    ffmpegArgs.push(
                        '-af', `loudnorm=I=${TARGET_LUFS}:LRA=${TARGET_LRA}:TP=${TARGET_TP}`
                    );
                    console.log(`[MUSIC] Using loudnorm: Target ${TARGET_LUFS} LUFS`);
                } else {
                    // Long videos: Use dynaudnorm (real-time, dynamic normalization)
                    ffmpegArgs.push(
                        '-af', 'dynaudnorm=f=500:g=31:p=0.95:m=10.0:r=0.9:b=1'
                    );
                    const hours = Math.floor(this.currentSong.duration / 3600);
                    const minutes = Math.floor((this.currentSong.duration % 3600) / 60);
                    console.log(`[MUSIC] Using dynaudnorm for long video (${hours}h ${minutes}m)`);
                }
            }

            // Add output format arguments
            ffmpegArgs.push(
                '-f', AUDIO.FORMAT,
                '-ar', AUDIO.SAMPLE_RATE,
                '-ac', AUDIO.CHANNELS,
                'pipe:1'
            );

            const ffmpeg = spawn(ffmpegPath, ffmpegArgs, {
                windowsHide: true
            });

            // Store ffmpeg process for cleanup
            this.currentFfmpeg = ffmpeg;

            // Handle ffmpeg exit to ensure cleanup
            ffmpeg.on('exit', (code, signal) => {
                console.log(`[MUSIC] FFmpeg exited with code ${code}, signal ${signal} for guild ${this.guildId}`);
                if (this.currentFfmpeg === ffmpeg) {
                    this.currentFfmpeg = null;
                }
            });

            const stream = ffmpeg.stdout;

            // Handle stream errors
            stream.on('error', (error) => {
                // Ignore "premature close" errors - these often occur when songs finish normally
                if (error.code === 'ERR_STREAM_PREMATURE_CLOSE') {
                    console.log(`[MUSIC] Stream closed for song ${this.currentSong?.title} (likely finished playing)`);
                    return; // Let the player's Idle event handle this naturally
                }
                console.error(`[ERROR] Stream error for song ${this.currentSong?.title}:`, error);
                this.isProcessingNext = false;
                this.player.stop(); // Let Idle event handler trigger playNext
            });

            let ffmpegErrors = '';
            ffmpeg.stderr.on('data', (data) => {
                // Collect FFmpeg errors for debugging
                ffmpegErrors += data.toString();
            });

            ffmpeg.on('error', (error) => {
                console.error(`[ERROR] FFmpeg process error for song ${this.currentSong?.title}:`, error);
                if (ffmpegErrors) {
                    console.error(`[ERROR] FFmpeg stderr output:`, ffmpegErrors.slice(-500)); // Last 500 chars
                }
                this.isProcessingNext = false;
                this.player.stop(); // Let Idle event handler trigger playNext
            });

            // Create audio resource
            const resource = createAudioResource(stream, {
                inputType: StreamType.Raw,
                inlineVolume: true
            });

            // Set reasonable volume
            resource.volume.setVolume(AUDIO.DEFAULT_VOLUME);

            // Play the resource
            this.player.play(resource);
            console.log(`[MUSIC] Audio resource started playing: ${this.currentSong.title} in guild ${this.guildId}`);

            // Reset retry count on successful playback
            this.retryCount = 0;
            // Clean up retried songs set on success
            this.retriedSongs.delete(this.currentSong?.url);

            // Reset flag after successfully starting playback
            // The Playing event will confirm it's actually playing
            this.isProcessingNext = false;

        } catch (error) {
            console.error(`[ERROR] Failed to play song in guild ${this.guildId}:`, error);
            console.error(`[ERROR] Song title:`, this.currentSong?.title);
            console.error(`[ERROR] Song URL:`, this.currentSong?.url);

            // Retry logic for transient errors
            // Only retry if we have a current song and haven't already retried this specific song
            if (this.currentSong && this.retryCount < this.maxRetries && !this.retriedSongs.has(this.currentSong.url)) {
                this.retryCount++;
                this.retriedSongs.add(this.currentSong.url);
                console.log(`[MUSIC] Retrying song (attempt ${this.retryCount}/${this.maxRetries}) for guild ${this.guildId}`);
                this.isProcessingNext = false;

                // Put song back at front of queue
                this.songs.unshift(this.currentSong);
                this.currentSong = null;

                // Retry after short delay
                setTimeout(() => this.playNext(), QUEUE.RETRY_DELAY_MS);
            } else {
                if (this.currentSong && this.retriedSongs.has(this.currentSong.url)) {
                    console.log(`[MUSIC] Song already retried, skipping for guild ${this.guildId}`);
                } else if (this.currentSong) {
                    console.log(`[MUSIC] Max retries reached, skipping song for guild ${this.guildId}`);
                } else {
                    console.log(`[MUSIC] No current song to retry for guild ${this.guildId}`);
                }
                this.retryCount = 0; // Reset for next song
                if (this.currentSong) {
                    this.retriedSongs.delete(this.currentSong.url); // Clean up
                }
                this.isProcessingNext = false;
                this.player.stop(); // Let Idle event trigger next song
            }
        }
    }

    pause() {
        if (this.player && this.isPlaying) {
            this.player.pause();
            return true;
        }
        return false;
    }

    resume() {
        if (this.player && this.isPaused()) {
            this.player.unpause();
            return true;
        }
        return false;
    }

    skip() {
        if (this.player && this.isPlaying) {
            this.player.stop();
            return true;
        }
        return false;
    }

    stop() {
        console.log(`[MUSIC] Stopping music in guild ${this.guildId}`);
        this.songs = [];
        this.isPlaying = false;
        this.currentSong = null;
        this.waitingForNext = false;
        this.isProcessingNext = false;
        this.clearInactivityTimeout();

        // Kill ffmpeg process if running
        if (this.currentFfmpeg && !this.currentFfmpeg.killed) {
            try {
                this.currentFfmpeg.kill('SIGKILL');
                this.currentFfmpeg = null;
            } catch (error) {
                console.error(`[ERROR] Error killing ffmpeg:`, error);
                // Force null even if kill fails
                this.currentFfmpeg = null;
            }
        }

        if (this.player) {
            try {
                this.player.stop();
            } catch (error) {
                console.error(`[ERROR] Error stopping player:`, error);
            }
        }

        if (this.connection) {
            try {
                this.connection.destroy();
            } catch (error) {
                console.error(`[ERROR] Error destroying connection:`, error);
            }
            this.connection = null;
        }
    }

    getQueue() {
        return this.songs;
    }

    getCurrentSong() {
        return this.currentSong;
    }

    isPaused() {
        return this.player && this.player.state.status === AudioPlayerStatus.Paused;
    }

    cleanup() {
        console.log(`[MUSIC] Cleaning up queue for guild ${this.guildId}`);

        // Remove all event listeners from player to prevent leaks
        if (this.player) {
            this.player.removeAllListeners();
        }

        // Kill ffmpeg if running
        if (this.currentFfmpeg && !this.currentFfmpeg.killed) {
            try {
                this.currentFfmpeg.kill('SIGKILL');
                this.currentFfmpeg = null;
            } catch (error) {
                console.error(`[ERROR] Error killing ffmpeg during cleanup:`, error);
                this.currentFfmpeg = null;
            }
        }

        // Destroy connection
        if (this.connection) {
            try {
                this.connection.destroy();
                this.connection = null;
            } catch (error) {
                console.error(`[ERROR] Error destroying connection during cleanup:`, error);
                this.connection = null;
            }
        }

        // Clear timeout
        this.clearInactivityTimeout();
    }
}

class QueueManager {
    constructor() {
        this.queues = new Map();
    }

    getQueue(guildId) {
        if (!this.queues.has(guildId)) {
            this.queues.set(guildId, new MusicQueue(guildId));
        }
        return this.queues.get(guildId);
    }

    deleteQueue(guildId) {
        const queue = this.queues.get(guildId);
        if (queue) {
            queue.stop();
            queue.cleanup(); // Clean up event listeners and resources
            this.queues.delete(guildId);
        }
    }
}

module.exports = new QueueManager();
