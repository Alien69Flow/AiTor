/**
 * 🔐 Security Agent
 * Agente especializado en auditoría de seguridad del repositorio
 */

import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { PromptTemplate } from "@langchain/core/prompts";
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const llm = new ChatGoogleGenerativeAI({
  modelName: "gemini-2.5-pro",
  temperature: 0.3,
});

export type SecurityLevel = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface SecurityFinding {
  id: string;
  level: SecurityLevel;
  title: string;
  description: string;
  affected: string;
  recommendation: string;
  references?: string[];
}

export interface SecurityReport {
  timestamp: Date;
  repository: string;
  branch: string;
  summary: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
  findings: SecurityFinding[];
  recommendations: string[];
  nextScan?: Date;
}

const securityPrompt = PromptTemplate.fromTemplate(`
Eres el AGENTE DE SEGURIDAD de AlienFlowSpace DAO.
Analiza los resultados de los escaneos de seguridad y genera un reporte estructurado.

CONTEXTO DEL PROYECTO:
- Proyecto: AiTor v.69 - Neural Intelligence Core
- Stack: React, TypeScript, Vite, Tailwind, Supabase
- Ecosistema: AlienFlowSpace DAO (DeFi, Web3)

RESULTADOS DEL ESCANEO:
{scanResults}

Analiza y responde en formato JSON:
{
  "summary": {
    "critical": número,
    "high": número,
    "medium": número,
    "low": número,
    "info": número
  },
  "findings": [
    {
      "id": "SEC-001",
      "level": "critical|high|medium|low|info",
      "title": "título del hallazgo",
      "description": "descripción detallada",
      "affected": "archivo o componente afectado",
      "recommendation": "cómo remediarlo",
      "references": ["links a documentación"]
    }
  ],
  "recommendations": ["lista de recomendaciones generales"],
  "nextSteps": ["acciones inmediatas recomendadas"]
}
`);

export class SecurityAgent {
  private static repositoryPath = '/workspace/project/AiTor';

  /**
   * Ejecuta un escaneo de seguridad completo
   */
  static async fullScan(): Promise<SecurityReport> {
    console.log('[SecurityAgent] Iniciando escaneo completo de seguridad...');

    const results = await Promise.allSettled([
      this.npmAudit(),
      this.dependencyCheck(),
      this.secretsCheck(),
      this.dependencyOutdated(),
    ]);

    const scanResults = results
      .filter(r => r.status === 'fulfilled')
      .map((r, i) => {
        const labels = ['npm audit', 'dependency check', 'secrets check', 'outdated'];
        return `=== ${labels[i]} ===\n${(r as PromiseFulfilledResult<string>).value}`;
      })
      .join('\n\n');

    const report = await this.generateReport(scanResults);
    console.log(`[SecurityAgent] Escaneo completo. Encontrados: ${report.summary.total} hallazgos`);
    
    return report;
  }

  /**
   * Escaneo rápido (npm audit)
   */
  static async quickScan(): Promise<SecurityReport> {
    console.log('[SecurityAgent] Escaneo rápido (npm audit)...');
    
    const auditResults = await this.npmAudit();
    const report = await this.generateReport(auditResults);
    
    return report;
  }

  /**
   * Escaneo de dependencias de npm
   */
  private static async npmAudit(): Promise<string> {
    try {
      const { stdout, stderr } = await execAsync('npm audit --json 2>/dev/null', {
        cwd: this.repositoryPath,
        timeout: 60000,
      });
      
      if (!stdout) return 'npm audit no devolvió resultados';
      
      try {
        const parsed = JSON.parse(stdout);
        const vulnerabilities = parsed.vulnerabilities || {};
        
        let summary = `npm audit results:\n`;
        summary += `- Total vulnerabilities: ${parsed.metadata?.vulnerabilities?.total || 0}\n`;
        
        for (const [severity, data] of Object.entries(vulnerabilities)) {
          const v = data as any;
          summary += `- ${severity}: ${v.count || 0}\n`;
          if (v.byDependency) {
            for (const [dep, issues] of Object.entries(v.byDependency)) {
              const issuesData = issues as any;
              summary += `  - ${dep}: ${issuesData.vulns?.length || 0} issues\n`;
            }
          }
        }
        
        return summary;
      } catch {
        return stdout;
      }
    } catch (error) {
      return `npm audit error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  /**
   * Verificación de dependencias outdated
   */
  private static async dependencyOutdated(): Promise<string> {
    try {
      const { stdout } = await execAsync('npm outdated --json 2>/dev/null', {
        cwd: this.repositoryPath,
        timeout: 30000,
      });
      
      if (!stdout) return 'Todas las dependencias están actualizadas';
      
      try {
        const outdated = JSON.parse(stdout);
        let summary = 'Dependencies outdated:\n';
        
        for (const [pkg, data] of Object.entries(outdated)) {
          const d = data as any;
          summary += `- ${pkg}: ${d.current} -> ${d.latest} (wanted: ${d.wanted})\n`;
        }
        
        return summary;
      } catch {
        return stdout;
      }
    } catch {
      return 'npm outdated no disponible o sin errores';
    }
  }

  /**
   * Verificación de secretos en código
   */
  private static async secretsCheck(): Promise<string> {
    try {
      // Buscar patrones comunes de secretos
      const patterns = [
        { name: 'API Keys', pattern: /api[_-]?key\s*[=:]\s*['"][a-zA-Z0-9]{20,}['"]/gi },
        { name: 'Private Keys', pattern: /private[_-]?key\s*[=:]\s*['"][a-zA-Z0-9+/=]{40,}['"]/gi },
        { name: 'Tokens', pattern: /token\s*[=:]\s*['"][a-zA-Z0-9]{20,}['"]/gi },
        { name: 'Passwords', pattern: /password\s*[=:]\s*['"][^'"]{8,}['"]/gi },
      ];

      let results = 'Secret scanning results:\n';

      for (const { name, pattern } of patterns) {
        try {
          const { stdout } = await execAsync(
            `grep -rnE '${pattern.source}' --include='*.ts' --include='*.tsx' --include='*.js' --include='*.jsx' --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=build . 2>/dev/null | head -20`,
            { cwd: this.repositoryPath }
          );
          
          if (stdout.trim()) {
            results += `⚠️ ${name} potenciales encontrados:\n${stdout}\n`;
          } else {
            results += `✓ ${name}: No encontrados\n`;
          }
        } catch {
          results += `✓ ${name}: No encontrados\n`;
        }
      }

      return results;
    } catch (error) {
      return `Secrets check error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  /**
   * Verificación general de dependencias
   */
  private static async dependencyCheck(): Promise<string> {
    try {
      const { stdout } = await execAsync('npm ls --depth=0 2>/dev/null', {
        cwd: this.repositoryPath,
        timeout: 30000,
      });
      return `Dependencies tree:\n${stdout}`;
    } catch {
      return 'No se pudo obtener el árbol de dependencias';
    }
  }

  /**
   * Genera el reporte estructurado usando LLM
   */
  private static async generateReport(scanResults: string): Promise<SecurityReport> {
    try {
      const chain = securityPrompt.pipe(llm);
      const response = await chain.invoke({ scanResults });
      
      const content = response.content.toString();
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        
        return {
          timestamp: new Date(),
          repository: 'AiTor',
          branch: 'main',
          summary: parsed.summary,
          findings: parsed.findings || [],
          recommendations: parsed.recommendations || [],
          nextScan: new Date(Date.now() + 24 * 60 * 60 * 1000), // Mañana
        };
      }
    } catch (error) {
      console.error('[SecurityAgent] Error parseando resultados:', error);
    }

    // Fallback si el LLM falla
    return {
      timestamp: new Date(),
      repository: 'AiTor',
      branch: 'main',
      summary: { total: 0, critical: 0, high: 0, medium: 0, low: 0, info: 0 },
      findings: [],
      recommendations: ['Revisar manualmente los resultados del escaneo'],
    };
  }

  /**
   * Genera el reporte en formato legible
   */
  static formatReport(report: SecurityReport): string {
    const emoji = {
      critical: '🔴',
      high: '🟠',
      medium: '🟡',
      low: '🟢',
      info: '🔵',
    };

    let message = `🛡️ **REPORTE DE SEGURIDAD**
━━━━━━━━━━━━━━━━━━━━━━
📅 ${report.timestamp.toISOString().split('T')[0]}
📦 Repositorio: ${report.repository}
🌿 Rama: ${report.branch}

**RESUMEN:**
🔴 Critical: ${report.summary.critical}
🟠 High: ${report.summary.high}
🟡 Medium: ${report.summary.medium}
🟢 Low: ${report.summary.low}
🔵 Info: ${report.summary.info}
━━━━━━━━━━━━━━━━━━━━━━\n`;

    if (report.findings.length > 0) {
      message += `**HALLAZGOS:**\n`;
      report.findings.forEach(f => {
        message += `\n${emoji[f.level]} **[${f.level.toUpperCase()}]** ${f.title}\n`;
        message += `   📍 ${f.affected}\n`;
        message += `   💡 ${f.recommendation}\n`;
      });
    } else {
      message += `✅ **No se encontraron vulnerabilidades críticas**\n`;
    }

    if (report.recommendations.length > 0) {
      message += `\n**RECOMENDACIONES:**\n`;
      report.recommendations.forEach((r, i) => {
        message += `${i + 1}. ${r}\n`;
      });
    }

    message += `\n⏰ Próximo escaneo: ${report.nextScan?.toISOString().split('T')[0] || 'No programado'}`;

    return message;
  }
}
