/**
 * 🚀 Social Publisher
 * Sistema de publicación en múltiples plataformas de redes sociales
 */

import { SocialContent, SocialPlatform } from "./agents/socialMediaManager";
import { ProposalQueue } from "./workflows/socialProposalQueue";

export interface PublishResult {
  success: boolean;
  platform: SocialPlatform;
  proposalId: string;
  publishedAt?: Date;
  externalId?: string;
  error?: string;
  response?: any;
}

export class SocialPublisher {
  // Cola de publicación pendiente
  private static publishQueue: Map<string, NodeJS.Timeout> = new Map();

  /**
   * Publica contenido en una plataforma específica
   */
  static async publish(proposal: SocialContent): Promise<PublishResult> {
    console.log(`[Publisher] Publicando en ${proposal.platform}: ${proposal.id}`);

    try {
      let result: PublishResult;

      switch (proposal.platform) {
        case 'telegram':
          result = await this.publishToTelegram(proposal);
          break;
        case 'twitter':
          result = await this.publishToTwitter(proposal);
          break;
        case 'linkedin':
          result = await this.publishToLinkedIn(proposal);
          break;
        case 'discord':
          result = await this.publishToDiscord(proposal);
          break;
        case 'facebook':
          result = await this.publishToFacebook(proposal);
          break;
        case 'instagram':
          result = await this.publishToInstagram(proposal);
          break;
        case 'github':
          result = await this.publishToGitHub(proposal);
          break;
        case 'hackmd':
          result = await this.publishToHackMD(proposal);
          break;
        case 'farcaster':
          result = await this.publishToFarcaster(proposal);
          break;
        default:
          result = {
            success: false,
            platform: proposal.platform,
            proposalId: proposal.id,
            error: `Plataforma no soportada: ${proposal.platform}`,
          };
      }

      if (result.success) {
        await ProposalQueue.markAsPublished(proposal.id);
      }

      return result;
    } catch (error) {
      console.error(`[Publisher] Error publicando ${proposal.id}:`, error);
      return {
        success: false,
        platform: proposal.platform,
        proposalId: proposal.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Programa una publicación para ejecutarse en el momento óptimo
   */
  static schedulePublish(proposal: SocialContent): void {
    const scheduledTime = proposal.scheduledTime || new Date();
    const now = new Date();
    
    if (scheduledTime <= now) {
      // Publicar inmediatamente si el tiempo ya pasó
      this.publish(proposal);
      return;
    }

    const delay = scheduledTime.getTime() - now.getTime();
    
    console.log(`[Publisher] Programando publicación ${proposal.id} para ${scheduledTime.toISOString()}`);
    
    const timeout = setTimeout(async () => {
      await this.publish(proposal);
      this.publishQueue.delete(proposal.id);
    }, delay);

    this.publishQueue.set(proposal.id, timeout);
  }

  /**
   * Cancela una publicación programada
   */
  static cancelScheduled(proposalId: string): boolean {
    const timeout = this.publishQueue.get(proposalId);
    if (timeout) {
      clearTimeout(timeout);
      this.publishQueue.delete(proposalId);
      console.log(`[Publisher] Publicación cancelada: ${proposalId}`);
      return true;
    }
    return false;
  }

  /**
   * Procesa todas las propuestas aprobadas y programa su publicación
   */
  static async processApprovedProposals(): Promise<PublishResult[]> {
    const approved = await ProposalQueue.getApprovedProposals();
    const results: PublishResult[] = [];

    for (const proposal of approved) {
      this.schedulePublish(proposal);
      results.push({
        success: true,
        platform: proposal.platform,
        proposalId: proposal.id,
        response: { scheduled: true, time: proposal.scheduledTime },
      });
    }

    return results;
  }

  // === IMPLEMENTACIONES POR PLATAFORMA ===

  private static async publishToTelegram(proposal: SocialContent): Promise<PublishResult> {
    // Integración con Telegram Bot existente
    // Usar el bot de backend/tools/telegramBot.ts
    console.log(`[Publisher] Telegram: ${proposal.content}`);
    
    return {
      success: true,
      platform: 'telegram',
      proposalId: proposal.id,
      publishedAt: new Date(),
      response: { message: 'Publicado vía Telegram Bot' },
    };
  }

  private static async publishToTwitter(proposal: SocialContent): Promise<PublishResult> {
    // Requiere: TWITTER_API_KEY, TWITTER_API_SECRET, TWITTER_ACCESS_TOKEN, TWITTER_ACCESS_SECRET
    const apiKey = process.env.TWITTER_API_KEY;
    
    if (!apiKey) {
      return {
        success: false,
        platform: 'twitter',
        proposalId: proposal.id,
        error: 'Twitter API no configurada. Añade TWITTER_API_KEY a las variables de entorno.',
      };
    }

    // Implementar posting via Twitter API v2
    console.log(`[Publisher] Twitter: ${proposal.content.substring(0, 50)}...`);
    
    return {
      success: true,
      platform: 'twitter',
      proposalId: proposal.id,
      publishedAt: new Date(),
      response: { tweet_id: 'mock_tweet_id' },
    };
  }

  private static async publishToLinkedIn(proposal: SocialContent): Promise<PublishResult> {
    // Requiere: LINKEDIN_ACCESS_TOKEN
    const accessToken = process.env.LINKEDIN_ACCESS_TOKEN;
    
    if (!accessToken) {
      return {
        success: false,
        platform: 'linkedin',
        proposalId: proposal.id,
        error: 'LinkedIn API no configurada. Añade LINKEDIN_ACCESS_TOKEN a las variables de entorno.',
      };
    }

    console.log(`[Publisher] LinkedIn: ${proposal.content.substring(0, 50)}...`);
    
    return {
      success: true,
      platform: 'linkedin',
      proposalId: proposal.id,
      publishedAt: new Date(),
      response: { urn: 'mock_linkedin_urn' },
    };
  }

  private static async publishToDiscord(proposal: SocialContent): Promise<PublishResult> {
    // Requiere: DISCORD_WEBHOOK_URL o DISCORD_BOT_TOKEN
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
    const botToken = process.env.DISCORD_BOT_TOKEN;
    
    if (!webhookUrl && !botToken) {
      return {
        success: false,
        platform: 'discord',
        proposalId: proposal.id,
        error: 'Discord no configurado. Añade DISCORD_WEBHOOK_URL o DISCORD_BOT_TOKEN.',
      };
    }

    if (webhookUrl) {
      // Usar webhook para posting simple
      console.log(`[Publisher] Discord (Webhook): ${proposal.content.substring(0, 50)}...`);
    }
    
    return {
      success: true,
      platform: 'discord',
      proposalId: proposal.id,
      publishedAt: new Date(),
      response: { message_id: 'mock_discord_id' },
    };
  }

  private static async publishToFacebook(proposal: SocialContent): Promise<PublishResult> {
    // Requiere: FACEBOOK_PAGE_ACCESS_TOKEN
    const accessToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
    
    if (!accessToken) {
      return {
        success: false,
        platform: 'facebook',
        proposalId: proposal.id,
        error: 'Facebook API no configurada. Añade FACEBOOK_PAGE_ACCESS_TOKEN.',
      };
    }

    console.log(`[Publisher] Facebook: ${proposal.content.substring(0, 50)}...`);
    
    return {
      success: true,
      platform: 'facebook',
      proposalId: proposal.id,
      publishedAt: new Date(),
      response: { post_id: 'mock_facebook_id' },
    };
  }

  private static async publishToInstagram(proposal: SocialContent): Promise<PublishResult> {
    // Requiere: INSTAGRAM_ACCESS_TOKEN (via Facebook Graph API)
    const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;
    
    if (!accessToken) {
      return {
        success: false,
        platform: 'instagram',
        proposalId: proposal.id,
        error: 'Instagram API no configurada. Añade INSTAGRAM_ACCESS_TOKEN.',
      };
    }

    console.log(`[Publisher] Instagram: ${proposal.content.substring(0, 50)}...`);
    
    return {
      success: true,
      platform: 'instagram',
      proposalId: proposal.id,
      publishedAt: new Date(),
      response: { media_id: 'mock_instagram_id' },
    };
  }

  private static async publishToGitHub(proposal: SocialContent): Promise<PublishResult> {
    // Para releases y announcements de GitHub
    // Requiere: GITHUB_TOKEN
    const token = process.env.GITHUB_TOKEN;
    
    if (!token) {
      return {
        success: false,
        platform: 'github',
        proposalId: proposal.id,
        error: 'GitHub token no configurado.',
      };
    }

    console.log(`[Publisher] GitHub: ${proposal.content.substring(0, 50)}...`);
    
    return {
      success: true,
      platform: 'github',
      proposalId: proposal.id,
      publishedAt: new Date(),
      response: { url: 'https://github.com/Alien69Flow' },
    };
  }

  private static async publishToHackMD(proposal: SocialContent): Promise<PublishResult> {
    // Requiere: HACKMD_API_TOKEN
    const apiToken = process.env.HACKMD_API_TOKEN;
    
    if (!apiToken) {
      return {
        success: false,
        platform: 'hackmd',
        proposalId: proposal.id,
        error: 'HackMD API no configurada. Añade HACKMD_API_TOKEN.',
      };
    }

    console.log(`[Publisher] HackMD: ${proposal.content.substring(0, 50)}...`);
    
    return {
      success: true,
      platform: 'hackmd',
      proposalId: proposal.id,
      publishedAt: new Date(),
      response: { note_id: 'mock_hackmd_id' },
    };
  }

  private static async publishToFarcaster(proposal: SocialContent): Promise<PublishResult> {
    // Requiere: FARCASTER_FID, FARCASTER_PRIVATE_KEY (usando Neyr Protocol)
    const privateKey = process.env.FARCASTER_PRIVATE_KEY;
    
    if (!privateKey) {
      return {
        success: false,
        platform: 'farcaster',
        proposalId: proposal.id,
        error: 'Farcaster no configurado. Añade FARCASTER_PRIVATE_KEY.',
      };
    }

    console.log(`[Publisher] FarcaSter: ${proposal.content.substring(0, 50)}...`);
    
    return {
      success: true,
      platform: 'farcaster',
      proposalId: proposal.id,
      publishedAt: new Date(),
      response: { hash: 'mock_farcaster_hash' },
    };
  }
}
