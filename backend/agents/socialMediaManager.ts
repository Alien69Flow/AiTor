/**
 * 🐦 Social Media Manager Agent
 * Agente especializado en gestión de redes sociales para AlienFlowSpace DAO
 * Genera propuestas de contenido, las presenta para aprobación y ejecuta tras confirmación
 */

import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { PromptTemplate } from "@langchain/core/prompts";
import { ProposalQueue } from "../workflows/socialProposalQueue";

const llm = new ChatGoogleGenerativeAI({
  modelName: "gemini-2.5-pro",
  temperature: 0.7, // Creativo para generar contenido
});

export type SocialPlatform = 
  | 'twitter' 
  | 'linkedin' 
  | 'instagram' 
  | 'facebook' 
  | 'discord' 
  | 'telegram'
  | 'farcaster'
  | 'github'
  | 'hackmd'
  | 'dorahacks';

export type ContentType = 'post' | 'thread' | 'article' | 'comment' | 'announcement';
export type FrequencyType = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';

export interface SocialContent {
  id: string;
  platform: SocialPlatform;
  contentType: ContentType;
  content: string;
  hashtags?: string[];
  media?: { type: 'image' | 'video' | 'link'; url: string }[];
  scheduledTime?: Date;
  frequency: FrequencyType;
  metadata: {
    generatedAt: Date;
    theme: string;
    tone: 'technical' | 'casual' | 'professional' | 'inspirational';
    targetAudience: string[];
  };
}

export interface SocialMediaProfile {
  platform: SocialPlatform;
  username: string;
  displayName: string;
  apiConnected: boolean;
  followers?: number;
  lastPosted?: Date;
}

const SOCIAL_MEDIA_PROFILES: SocialMediaProfile[] = [
  { platform: 'twitter', username: '@Alien69Flow', displayName: 'Alien69Flow', apiConnected: false },
  { platform: 'linkedin', username: 'alienflowspace', displayName: 'AlienFlowSpace DAO', apiConnected: false },
  { platform: 'linkedin', username: 'alien69flow', displayName: 'Alien69Flow (Founder)', apiConnected: false },
  { platform: 'instagram', username: '@alien69flow', displayName: 'Alien69Flow', apiConnected: false },
  { platform: 'facebook', username: '@Alien69Flow', displayName: 'Alien69Flow', apiConnected: false },
  { platform: 'discord', username: 'AlienFlowSpace', displayName: 'AlienFlowSpace Server', apiConnected: false },
  { platform: 'farcaster', username: '@alien69flow', displayName: 'alien69flow', apiConnected: false },
  { platform: 'github', username: '@Alien69Flow', displayName: 'Alien69Flow', apiConnected: false },
  { platform: 'hackmd', username: '@Alien69Flow', displayName: 'Alien69Flow', apiConnected: false },
  { platform: 'dorahacks', username: '@Alien69Flow', displayName: 'Alien69Flow', apiConnected: false },
  { platform: 'telegram', username: '@AlienFlowSpaceDAO', displayName: 'AlienFlowSpace DAO', apiConnected: true },
];

const CONTENT_THEMES = {
  technical: ['DeFi protocols', 'Blockchain scalability', 'DAO governance', 'Smart contracts', 'Web3 security'],
  educational: ['Crypto basics', 'DeFi explained', 'DAO participation', 'Yield strategies', 'NFT utility'],
  community: ['DAO updates', 'Partnership announcements', 'Community highlights', 'Event recaps', 'Milestone celebrations'],
  visionary: ['Future of finance', 'Decentralized future', 'Quantum computing', 'Energy sustainability', 'Interplanetary governance'],
};

const promptTemplates = {
  daily: PromptTemplate.fromTemplate(`
Eres el SOCIAL MEDIA MANAGER de AlienFlowSpace DAO.
Genera contenido para publicación DIARIA en redes sociales.

CONTEXTO:
- Proyecto: ΔlieπFlΦw $pac€ - DAO descentralizada
- Token: A₿TC (Aurum nostrum non est aurum vulgi)
- Misión: Sovereignty, Energy Efficiency, Environmental Sustainability, Web 3/4/5
- Ecosistema: BioFi, DeFi, DePin, DeSci, IPFS, QFS, ReFi, RWA, SocialFi, TradFi

TEMA PRINCIPAL PARA HOY: {theme}
TONO: {tone}
PLATAFORMA: {platform}
PLATAFORMA PRINCIPAL: {mainPlatform}

Genera contenido ORIGINAL y ENGAGING. Incluye:
1. Texto principal (máx 280 chars para Twitter, adaptable para otras plataformas)
2. 3-5 hashtags relevantes
3. Call-to-action si es apropiado
4. Sugerencia de imagen/visual si aplica

Responde en formato JSON:
{
  "content": "texto del post",
  "hashtags": ["#hashtag1", "#hashtag2"],
  "cta": "llamada a la acción",
  "imageSuggestion": "descripción de imagen sugerida"
}
`),

  weekly: PromptTemplate.fromTemplate(`
Eres el SOCIAL MEDIA STRATEGIST de AlienFlowSpace DAO.
Crea un CALENDARIO SEMANAL de contenido para múltiples plataformas.

CONTEXTO:
- Proyecto: ΔlieπFlΦw $pac€ - DAO descentralizada  
- Token: A₿TC (Aurum nostrum non est aurum vulgi)
- Misión: Sovereignty, Energy Efficiency, Environmental Sustainability

PLATAFORMAS A CUBRIR: {platforms}
SEMANA: {weekStart} - {weekEnd}

Crea contenido para CADA DÍA de la semana:
- Lunes: Contenido educativo/técnico
- Martes: Actualización de DAO/proyecto
- Miércoles: Contenido comunitario
- Jueves: Featured/spotlight
- Viernes: Contenido inspiracional/visionario
- Sábado: Meme/engagement
- Domingo: Reflexión/histórico

Responde en formato JSON con array de 7 posts diarios:
{
  "posts": [
    {
      "day": "lunes",
      "platform": "twitter",
      "theme": "tema del día",
      "content": "contenido del post",
      "hashtags": ["#hashtags"],
      "bestTime": "09:00 UTC"
    }
  ]
}
`),

  monthly: PromptTemplate.fromTemplate(`
Eres el CHIEF CONTENT OFFICER de AlienFlowSpace DAO.
Diseña la ESTRATEGIA MENSUAL de contenido.

MES: {month} {year}
TEMA CENTRAL: {centralTheme}
PRIORIDADES DEL MES: {priorities}

Crea:
1. Calendario de 4 semanas con temas principales
2. 3-4 campaigns/piezas de contenido flagship
3. Eventos/announcements planeados
4. Métricas a trackear
5. Análisis de competidores

PLATAFORMAS: {platforms}

Responde en JSON estructurado con el plan mensual completo.
`),

  quarterly: PromptTemplate.fromTemplate(`
Eres el STRATEGIC PLANNER de AlienFlowSpace DAO.
Crea el PLAN TRIMESTRAL de contenido y comunidad.

TRIMESTRE: {quarter} {year}
REVISIÓN DEL TRIMESTRE ANTERIOR: {lastQuarterReview}

Incluye:
1. Objetivos del trimestre
2. KPIs y métricas
3. Eventos principales
4. Expansión de audiencia
5. Partnerships a buscar
6. Contenido flagship
7. Budget allocation

PLATAFORMAS: {platforms}
`),

  yearly: PromptTemplate.fromTemplate(`
Eres el VISIONARY STRATEGIST de AlienFlowSpace DAO.
Diseña la ESTRATEGIA ANUAL de comunicaciones.

AÑO: {year}
VISIÓN DEL PROYECTO: {vision}

Crea un PLAN ESTRATÉGICO ANUAL:
1. Timeline de milestones
2. Eventos corporativos anuales
3. Campañas de marca
4. Expansión a nuevos mercados
5. Budget y recursos
6. Equipo necesario
7. KPIs anuales

PLATAFORMAS: {allPlatforms}

Este documento guiará toda la comunicación del año.
`),
};

export class SocialMediaManager {
  /**
   * Genera propuestas de contenido según la frecuencia solicitada
   */
  static async generateContent(
    frequency: FrequencyType,
    options: {
      platform?: SocialPlatform;
      theme?: string;
      tone?: SocialContent['metadata']['tone'];
      customContext?: string;
    } = {}
  ): Promise<{ proposals: SocialContent[]; summary: string }> {
    console.log(`[SocialManager] Generando contenido ${frequency} para plataforma: ${options.platform || 'todas'}`);

    try {
      const now = new Date();
      let proposals: SocialContent[] = [];

      switch (frequency) {
        case 'daily': {
          const theme = options.theme || this.getRandomTheme();
          const tone = options.tone || 'technical';
          const platforms = options.platform ? [options.platform] : ['twitter', 'linkedin', 'telegram'];
          
          for (const platform of platforms) {
            const chain = promptTemplates.daily.pipe(llm);
            const response = await chain.invoke({
              theme,
              tone,
              platform,
              mainPlatform: 'Twitter',
            });
            
            const parsed = this.parseContentResponse(response.content.toString());
            if (parsed) {
              proposals.push({
                id: `daily_${platform}_${Date.now()}`,
                platform: platform as SocialPlatform,
                contentType: 'post',
                content: parsed.content,
                hashtags: parsed.hashtags,
                scheduledTime: this.getOptimalPostTime(platform as SocialPlatform),
                frequency: 'daily',
                metadata: {
                  generatedAt: now,
                  theme,
                  tone: tone as SocialContent['metadata']['tone'],
                  targetAudience: ['crypto-enthusiasts', 'dao-members', 'web3-developers'],
                },
              });
            }
          }
          break;
        }

        case 'weekly': {
          const weekStart = this.getWeekStart(now);
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekEnd.getDate() + 6);
          
          const chain = promptTemplates.weekly.pipe(llm);
          const response = await chain.invoke({
            platforms: ['Twitter', 'LinkedIn', 'Instagram', 'Telegram', 'Discord'],
            weekStart: weekStart.toISOString().split('T')[0],
            weekEnd: weekEnd.toISOString().split('T')[0],
          });
          
          const parsed = this.parseWeeklyResponse(response.content.toString());
          proposals = parsed.map((post, i) => ({
            id: `weekly_${i}_${Date.now()}`,
            platform: post.platform as SocialPlatform,
            contentType: 'post',
            content: post.content,
            hashtags: post.hashtags,
            scheduledTime: new Date(`${post.day} ${post.bestTime}`),
            frequency: 'weekly',
            metadata: {
              generatedAt: now,
              theme: post.theme,
              tone: 'mixed' as const,
              targetAudience: ['crypto-enthusiasts', 'dao-members'],
            },
          }));
          break;
        }

        case 'monthly': {
          const chain = promptTemplates.monthly.pipe(llm);
          const response = await chain.invoke({
            month: now.toLocaleString('default', { month: 'long' }),
            year: now.getFullYear(),
            centralTheme: options.theme || 'DAO Growth & Community',
            priorities: ['User adoption', 'Partnerships', 'Technical development'],
            platforms: ['Twitter', 'LinkedIn', 'Instagram', 'Discord', 'Telegram'],
          });
          
          // Generar posts mensuales basados en la respuesta
          const monthlyPlan = this.parseMonthlyResponse(response.content.toString());
          proposals = monthlyPlan.posts.map((post, i) => ({
            id: `monthly_${i}_${Date.now()}`,
            platform: post.platform as SocialPlatform,
            contentType: 'article',
            content: post.content,
            hashtags: post.hashtags,
            scheduledTime: new Date(post.scheduledDate),
            frequency: 'monthly',
            metadata: {
              generatedAt: now,
              theme: post.theme,
              tone: 'professional' as const,
              targetAudience: ['investors', 'partners', 'community'],
            },
          }));
          break;
        }

        case 'quarterly': {
          const quarter = Math.ceil((now.getMonth() + 1) / 3);
          const chain = promptTemplates.quarterly.pipe(llm);
          const response = await chain.invoke({
            quarter: `Q${quarter}`,
            year: now.getFullYear(),
            lastQuarterReview: 'Growth in community, focus on DeFi integration',
            platforms: ['Twitter', 'LinkedIn', 'Discord', 'Medium'],
          });
          
          // Generar documento estratégico
          const quarterlyDoc = {
            id: `quarterly_${Date.now()}`,
            platform: 'hackmd' as SocialPlatform,
            contentType: 'article' as const,
            content: response.content.toString(),
            frequency: 'quarterly' as FrequencyType,
            metadata: {
              generatedAt: now,
              theme: `Q${quarter} Strategy`,
              tone: 'professional' as const,
              targetAudience: ['team', 'investors', 'partners'],
            },
          };
          proposals = [quarterlyDoc];
          break;
        }

        case 'yearly': {
          const chain = promptTemplates.yearly.pipe(llm);
          const response = await chain.invoke({
            year: now.getFullYear(),
            vision: 'Making decentralized finance accessible to all while promoting energy sustainability',
            allPlatforms: ['Twitter', 'LinkedIn', 'Instagram', 'Discord', 'Telegram', 'Farcaster', 'YouTube'],
          });
          
          const yearlyDoc = {
            id: `yearly_${Date.now()}`,
            platform: 'hackmd' as SocialPlatform,
            contentType: 'article' as const,
            content: response.content.toString(),
            frequency: 'yearly' as FrequencyType,
            metadata: {
              generatedAt: now,
              theme: `${now.getFullYear()} Annual Strategy`,
              tone: 'inspirational' as const,
              targetAudience: ['all'],
            },
          };
          proposals = [yearlyDoc];
          break;
        }
      }

      // Guardar propuestas en cola
      await ProposalQueue.addProposals(proposals);

      const summary = `${proposals.length} propuesta(s) generada(s) para ${frequency}. Listos para tu revisión.`;

      return { proposals, summary };
    } catch (error) {
      console.error("[SocialManager] Error generando contenido:", error);
      return { proposals: [], summary: "Error al generar propuestas de contenido." };
    }
  }

  /**
   * Obtiene propuestas pendientes de aprobación
   */
  static async getPendingProposals(): Promise<SocialContent[]> {
    return await ProposalQueue.getPendingProposals();
  }

  /**
   * Aprueba una propuesta para ejecución
   */
  static async approveProposal(proposalId: string, approvedBy: string): Promise<boolean> {
    return await ProposalQueue.approveProposal(proposalId, approvedBy);
  }

  /**
   * Rechaza una propuesta
   */
  static async rejectProposal(proposalId: string, reason?: string): Promise<boolean> {
    return await ProposalQueue.rejectProposal(proposalId, reason);
  }

  /**
   * Obtiene propuestas aprobadas listas para ejecución
   */
  static async getApprovedProposals(): Promise<SocialContent[]> {
    return await ProposalQueue.getApprovedProposals();
  }

  /**
   * Obtiene el estado de todas las plataformas
   */
  static getPlatformStatus(): SocialMediaProfile[] {
    return SOCIAL_MEDIA_PROFILES;
  }

  // Helpers privados

  private static getRandomTheme(): string {
    const allThemes = Object.values(CONTENT_THEMES).flat();
    return allThemes[Math.floor(Math.random() * allThemes.length)];
  }

  private static getOptimalPostTime(platform: SocialPlatform): Date {
    const optimalHours: Record<SocialPlatform, number[]> = {
      twitter: [9, 12, 17, 20], // Best engagement times
      linkedin: [8, 12, 17],
      instagram: [11, 17, 20],
      facebook: [13, 16, 20],
      discord: [15, 19, 21],
      telegram: [10, 14, 18],
      farcaster: [14, 18, 21],
      github: [10, 14],
      hackmd: [11, 15],
      dorahacks: [12, 16],
    };
    
    const hours = optimalHours[platform] || [12];
    const selectedHour = hours[Math.floor(Math.random() * hours.length)];
    
    const result = new Date();
    result.setHours(selectedHour, 0, 0, 0);
    if (result < new Date()) {
      result.setDate(result.getDate() + 1);
    }
    
    return result;
  }

  private static getWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
  }

  private static parseContentResponse(response: string): any {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.error("[SocialManager] Error parsing response:", e);
    }
    return null;
  }

  private static parseWeeklyResponse(response: string): any[] {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return parsed.posts || [];
      }
    } catch (e) {
      console.error("[SocialManager] Error parsing weekly response:", e);
    }
    return [];
  }

  private static parseMonthlyResponse(response: string): any {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.error("[SocialManager] Error parsing monthly response:", e);
    }
    return { posts: [] };
  }
}
