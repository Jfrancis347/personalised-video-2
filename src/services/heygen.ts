import { env } from '../config/env';

interface VideoResponse {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  video_url?: string;
  error?: string;
}

class HeyGenAPI {
  private isDevelopment = import.meta.env.DEV;

  private async makeRequest(endpoint: string, options: RequestInit = {}) {
    if (this.isDevelopment) {
      return this.mockResponse(endpoint, options);
    }

    try {
      const response = await fetch(`/.netlify/functions/heygen-proxy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          endpoint,
          method: options.method || 'GET',
          body: options.body ? JSON.parse(options.body as string) : undefined
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ 
          error: `HTTP error! status: ${response.status}`
        }));
        throw new Error(JSON.stringify(errorData));
      }

      return response.json();
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  private mockResponse(endpoint: string, options: RequestInit) {
    console.log('Development mode: Mocking API response for', endpoint);
    
    switch (endpoint) {
      case '/avatars':
        return Promise.resolve({
          data: [
            {
              id: 'mock_avatar_1',
              name: 'Mock Avatar 1',
              status: 'completed',
              thumbnail_url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400&fit=crop',
              created_at: new Date().toISOString()
            },
            {
              id: 'mock_avatar_2',
              name: 'Mock Avatar 2',
              status: 'completed',
              thumbnail_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&fit=crop',
              created_at: new Date().toISOString()
            }
          ]
        });
      
      case '/videos':
        if (options.method === 'POST') {
          return Promise.resolve({
            video_id: `dev_${Date.now()}`,
            status: 'pending',
            video_url: 'https://example.com/sample-video.mp4'
          });
        }
        break;

      default:
        if (endpoint.startsWith('/videos/')) {
          const videoId = endpoint.split('/')[2];
          const timestamp = parseInt(videoId.split('_')[1] || '0');
          const elapsedTime = Date.now() - timestamp;
          
          if (elapsedTime < 5000) {
            return Promise.resolve({ status: 'pending' });
          } else if (elapsedTime < 10000) {
            return Promise.resolve({ status: 'processing' });
          } else {
            return Promise.resolve({
              status: 'completed',
              video_url: 'https://example.com/sample-video.mp4'
            });
          }
        }
    }

    return Promise.resolve({});
  }

  async validateApiKey(): Promise<boolean> {
    try {
      const response = await this.makeRequest('/avatars');
      return Array.isArray(response.data);
    } catch (error) {
      console.error('Error validating API key:', error);
      return false;
    }
  }

  async listAvatars() {
    try {
      const response = await this.makeRequest('/avatars');
      return response.data || [];
    } catch (error) {
      console.error('Error listing avatars:', error);
      throw error;
    }
  }

  async createVideoInProject(
    avatarId: string,
    script: string,
    contact: any
  ): Promise<VideoResponse> {
    if (!avatarId || !script) {
      throw new Error('Avatar ID and script are required');
    }

    try {
      const payload = {
        avatar_id: avatarId,
        background: {
          type: "color",
          value: "#ffffff"
        },
        clips: [
          {
            avatar_id: avatarId,
            avatar_style: "normal",
            input_text: script,
            voice_id: "en-US-JennyNeural",
            voice_settings: {
              stability: 0.5,
              similarity: 0.75
            },
            background: {
              type: "color",
              value: "#ffffff"
            },
            video_settings: {
              ratio: "16:9",
              quality: "high"
            }
          }
        ],
        test: this.isDevelopment,
        enhance: true
      };

      const data = await this.makeRequest('/videos', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      return {
        id: data.video_id || data.id,
        status: 'pending',
        video_url: data.video_url
      };
    } catch (error) {
      console.error('Error creating video:', error);
      throw error instanceof Error ? error : new Error('Failed to create video');
    }
  }

  async getVideoStatus(videoId: string): Promise<VideoResponse> {
    if (!videoId) {
      throw new Error('Video ID is required');
    }

    try {
      const data = await this.makeRequest(`/videos/${videoId}`);
      
      return {
        id: videoId,
        status: data.status,
        video_url: data.video_url,
        error: data.error
      };
    } catch (error) {
      console.error('Error getting video status:', error);
      throw error instanceof Error ? error : new Error('Failed to get video status');
    }
  }
}

export const heygenApi = new HeyGenAPI();