const {
    validateVoiceChannel,
    validateBotPermissions,
    validateMusicPlaying,
    validateSongPlaying,
    validateYouTubeInput,
    validateSoundCloudInput,
    validateMusicInput,
} = require('../utils/validators');

describe('validateYouTubeInput', () => {
    describe('Regular Video URLs', () => {
        test('should detect standard YouTube video URL', () => {
            const result = validateYouTubeInput('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
            expect(result.isUrl).toBe(true);
            expect(result.url).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
            expect(result.isPlaylist).toBe(false);
            expect(result.playlistId).toBe(null);
            expect(result.videoId).toBe('dQw4w9WgXcQ');
        });

        test('should detect youtu.be short URL', () => {
            const result = validateYouTubeInput('https://youtu.be/dQw4w9WgXcQ');
            expect(result.isUrl).toBe(true);
            expect(result.videoId).toBe('dQw4w9WgXcQ');
            expect(result.isPlaylist).toBe(false);
        });

        test('should detect YouTube shorts URL', () => {
            const result = validateYouTubeInput('https://www.youtube.com/shorts/dQw4w9WgXcQ');
            expect(result.isUrl).toBe(true);
            expect(result.videoId).toBe('dQw4w9WgXcQ');
            expect(result.isPlaylist).toBe(false);
        });

        test('should work without protocol', () => {
            const result = validateYouTubeInput('youtube.com/watch?v=dQw4w9WgXcQ');
            expect(result.isUrl).toBe(true);
            expect(result.videoId).toBe('dQw4w9WgXcQ');
        });

        test('should work without www', () => {
            const result = validateYouTubeInput('https://youtube.com/watch?v=dQw4w9WgXcQ');
            expect(result.isUrl).toBe(true);
            expect(result.videoId).toBe('dQw4w9WgXcQ');
        });
    });

    describe('Playlist URLs', () => {
        test('should detect playlist URL with video', () => {
            const result = validateYouTubeInput('https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf');
            expect(result.isUrl).toBe(true);
            expect(result.isPlaylist).toBe(true);
            expect(result.playlistId).toBe('PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf');
            expect(result.videoId).toBe('dQw4w9WgXcQ');
        });

        test('should detect playlist-only URL', () => {
            const result = validateYouTubeInput('https://www.youtube.com/playlist?list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf');
            expect(result.isUrl).toBe(true);
            expect(result.isPlaylist).toBe(true);
            expect(result.playlistId).toBe('PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf');
            expect(result.videoId).toBe(null);
        });

        test('should handle list parameter after video ID', () => {
            const result = validateYouTubeInput('https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf&index=1');
            expect(result.isUrl).toBe(true);
            expect(result.isPlaylist).toBe(true);
            expect(result.playlistId).toBe('PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf');
            expect(result.videoId).toBe('dQw4w9WgXcQ');
            expect(result.url).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf');
        });
    });

    describe('Search Queries', () => {
        test('should identify search query', () => {
            const result = validateYouTubeInput('lofi hip hop');
            expect(result.isUrl).toBe(false);
            expect(result.url).toBe(null);
            expect(result.isPlaylist).toBe(false);
            expect(result.playlistId).toBe(null);
            expect(result.videoId).toBe(null);
        });

        test('should identify artist + song as search', () => {
            const result = validateYouTubeInput('Rick Astley Never Gonna Give You Up');
            expect(result.isUrl).toBe(false);
        });
    });

    describe('Edge Cases', () => {
        test('should handle empty string', () => {
            const result = validateYouTubeInput('');
            expect(result.isUrl).toBe(false);
        });

        test('should handle invalid URL', () => {
            const result = validateYouTubeInput('https://example.com');
            expect(result.isUrl).toBe(false);
        });

        test('should handle partial YouTube URL', () => {
            const result = validateYouTubeInput('youtube.com/incomplete');
            expect(result.isUrl).toBe(false);
        });

        test('should handle video ID with special characters', () => {
            const result = validateYouTubeInput('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
            expect(result.videoId).toBe('dQw4w9WgXcQ');
        });
    });
});

describe('validateVoiceChannel', () => {
    test('should return invalid when user not in voice channel', () => {
        const mockInteraction = {
            member: {
                voice: {
                    channel: null
                }
            }
        };

        const result = validateVoiceChannel(mockInteraction);
        expect(result.valid).toBe(false);
        expect(result.channel).toBe(null);
        expect(result.error).toBe('You need to be in a voice channel to play music!');
    });

    test('should return valid when user in voice channel', () => {
        const mockChannel = { id: '123', name: 'General' };
        const mockInteraction = {
            member: {
                voice: {
                    channel: mockChannel
                }
            }
        };

        const result = validateVoiceChannel(mockInteraction);
        expect(result.valid).toBe(true);
        expect(result.channel).toBe(mockChannel);
        expect(result.error).toBe(null);
    });
});

describe('validateBotPermissions', () => {
    test('should return invalid when bot lacks Connect permission', () => {
        const mockVoiceChannel = {
            permissionsFor: () => ({
                has: (perm) => perm !== 'Connect'
            })
        };
        const mockClient = { user: {} };

        const result = validateBotPermissions(mockVoiceChannel, mockClient);
        expect(result.valid).toBe(false);
        expect(result.error).toBe('I need permissions to join and speak in your voice channel!');
    });

    test('should return invalid when bot lacks Speak permission', () => {
        const mockVoiceChannel = {
            permissionsFor: () => ({
                has: (perm) => perm !== 'Speak'
            })
        };
        const mockClient = { user: {} };

        const result = validateBotPermissions(mockVoiceChannel, mockClient);
        expect(result.valid).toBe(false);
    });

    test('should return valid when bot has all permissions', () => {
        const mockVoiceChannel = {
            permissionsFor: () => ({
                has: () => true
            })
        };
        const mockClient = { user: {} };

        const result = validateBotPermissions(mockVoiceChannel, mockClient);
        expect(result.valid).toBe(true);
        expect(result.error).toBe(null);
    });
});

describe('validateMusicPlaying', () => {
    test('should return invalid when nothing is playing and queue is empty', () => {
        const mockQueue = {
            getCurrentSong: () => null,
            getQueue: () => []
        };

        const result = validateMusicPlaying(mockQueue);
        expect(result.valid).toBe(false);
        expect(result.error).toBe('There is no music playing!');
    });

    test('should return valid when song is playing', () => {
        const mockQueue = {
            getCurrentSong: () => ({ title: 'Test Song' }),
            getQueue: () => []
        };

        const result = validateMusicPlaying(mockQueue);
        expect(result.valid).toBe(true);
        expect(result.error).toBe(null);
    });

    test('should return valid when queue has songs', () => {
        const mockQueue = {
            getCurrentSong: () => null,
            getQueue: () => [{ title: 'Queued Song' }]
        };

        const result = validateMusicPlaying(mockQueue);
        expect(result.valid).toBe(true);
    });

    test('should return valid when both playing and queued', () => {
        const mockQueue = {
            getCurrentSong: () => ({ title: 'Current Song' }),
            getQueue: () => [{ title: 'Queued Song' }]
        };

        const result = validateMusicPlaying(mockQueue);
        expect(result.valid).toBe(true);
    });
});

describe('validateSongPlaying', () => {
    test('should return invalid when no song is playing', () => {
        const mockQueue = {
            getCurrentSong: () => null
        };

        const result = validateSongPlaying(mockQueue);
        expect(result.valid).toBe(false);
        expect(result.currentSong).toBe(null);
        expect(result.error).toBe('There is no song playing!');
    });

    test('should return valid when song is playing', () => {
        const mockSong = { title: 'Test Song', url: 'https://example.com' };
        const mockQueue = {
            getCurrentSong: () => mockSong
        };

        const result = validateSongPlaying(mockQueue);
        expect(result.valid).toBe(true);
        expect(result.currentSong).toBe(mockSong);
        expect(result.error).toBe(null);
    });
});

describe('validateSoundCloudInput', () => {
    describe('SoundCloud Track URLs', () => {
        test('should detect standard SoundCloud track URL', () => {
            const result = validateSoundCloudInput('https://soundcloud.com/artist/track-name');
            expect(result.isUrl).toBe(true);
            expect(result.url).toBe('https://soundcloud.com/artist/track-name');
            expect(result.isPlaylist).toBe(false);
            expect(result.platform).toBe('soundcloud');
        });

        test('should detect SoundCloud URL without protocol', () => {
            const result = validateSoundCloudInput('soundcloud.com/artist/track-name');
            expect(result.isUrl).toBe(true);
            expect(result.url).toBe('https://soundcloud.com/artist/track-name');
            expect(result.isPlaylist).toBe(false);
        });

        test('should detect SoundCloud mobile URL', () => {
            const result = validateSoundCloudInput('https://m.soundcloud.com/artist/track-name');
            expect(result.isUrl).toBe(true);
            expect(result.isPlaylist).toBe(false);
        });

        test('should detect SoundCloud short URL', () => {
            const result = validateSoundCloudInput('https://on.soundcloud.com/abc123');
            expect(result.isUrl).toBe(true);
            expect(result.isPlaylist).toBe(false);
        });

        test('should detect SoundCloud URL with query parameters', () => {
            const result = validateSoundCloudInput('https://soundcloud.com/user-335757686/ronny-will-ballern?utm_source=clipboard&utm_medium=text&utm_campaign=social_sharing');
            expect(result.isUrl).toBe(true);
            expect(result.isPlaylist).toBe(false);
            expect(result.platform).toBe('soundcloud');
        });

        test('should detect realistic SoundCloud URL from share button', () => {
            const result = validateSoundCloudInput('https://soundcloud.com/user-335757686/ronny-will-ballern?utm_source=clipboard&utm_medium=text&utm_campaign=social_sharing');
            expect(result.isUrl).toBe(true);
            expect(result.url).toBe('https://soundcloud.com/user-335757686/ronny-will-ballern?utm_source=clipboard&utm_medium=text&utm_campaign=social_sharing');
            expect(result.isPlaylist).toBe(false);
            expect(result.platform).toBe('soundcloud');
        });
    });

    describe('SoundCloud Playlist URLs', () => {
        test('should detect SoundCloud playlist URL', () => {
            const result = validateSoundCloudInput('https://soundcloud.com/artist/sets/playlist-name');
            expect(result.isUrl).toBe(true);
            expect(result.url).toBe('https://soundcloud.com/artist/sets/playlist-name');
            expect(result.isPlaylist).toBe(true);
            expect(result.platform).toBe('soundcloud');
        });

        test('should detect SoundCloud playlist without protocol', () => {
            const result = validateSoundCloudInput('soundcloud.com/artist/sets/my-playlist');
            expect(result.isUrl).toBe(true);
            expect(result.isPlaylist).toBe(true);
        });
    });

    describe('Non-SoundCloud URLs', () => {
        test('should return invalid for YouTube URL', () => {
            const result = validateSoundCloudInput('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
            expect(result.isUrl).toBe(false);
        });

        test('should return invalid for random URL', () => {
            const result = validateSoundCloudInput('https://example.com');
            expect(result.isUrl).toBe(false);
        });

        test('should return invalid for search query', () => {
            const result = validateSoundCloudInput('lofi hip hop');
            expect(result.isUrl).toBe(false);
        });
    });
});

describe('validateMusicInput', () => {
    describe('Platform Detection', () => {
        test('should detect SoundCloud URL and return soundcloud platform', () => {
            const result = validateMusicInput('https://soundcloud.com/artist/track');
            expect(result.platform).toBe('soundcloud');
            expect(result.isUrl).toBe(true);
            expect(result.url).toBe('https://soundcloud.com/artist/track');
        });

        test('should detect YouTube URL and return youtube platform', () => {
            const result = validateMusicInput('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
            expect(result.platform).toBe('youtube');
            expect(result.isUrl).toBe(true);
            expect(result.videoId).toBe('dQw4w9WgXcQ');
        });

        test('should default to youtube platform for search queries', () => {
            const result = validateMusicInput('lofi hip hop');
            expect(result.platform).toBe('youtube');
            expect(result.isUrl).toBe(false);
        });
    });

    describe('Playlist Detection', () => {
        test('should detect SoundCloud playlist', () => {
            const result = validateMusicInput('https://soundcloud.com/artist/sets/playlist');
            expect(result.platform).toBe('soundcloud');
            expect(result.isPlaylist).toBe(true);
        });

        test('should detect YouTube playlist', () => {
            const result = validateMusicInput('https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLtest123');
            expect(result.platform).toBe('youtube');
            expect(result.isPlaylist).toBe(true);
            expect(result.playlistId).toBe('PLtest123');
        });
    });

    describe('Priority Order', () => {
        test('should prioritize SoundCloud detection over YouTube', () => {
            const result = validateMusicInput('https://soundcloud.com/artist/track');
            expect(result.platform).toBe('soundcloud');
        });
    });
});
