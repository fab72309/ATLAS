import OpenAI from 'openai';
import { auth } from './firebase';
import { DOCTRINE_CONTEXT } from '../constants/doctrine';

const PROMPT_ID = 'pmpt_69335ad9b51c8195832b50cc47e91f0f02e34251eac6000c';

const ASSISTANT_IDS = {
  group: 'asst_Bsocyc9ni7fjeReaEBBsHCzi',
  column: 'asst_Uk4muOm9jLF3TWsYY2n0dxSI',
  site: 'asst_Bsocyc9ni7fjeReaEBBsHCzi',
  communication: 'asst_Hc0fc9SD87L763ZIMDVeNWzQ'
} as const;

export const analyzeEmergency = async (
  situation: string,
  type: 'group' | 'column' | 'site' | 'communication',
  opts?: {
    dominante?: string;
    secondaryRisks?: string[];
    extraContext?: string;
    sections?: Record<string, string>;
  }
) => {
  try {
    const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('Clé API OpenAI manquante.');
    }

    // NOUVEAU MODE: Prompt API (Uniquement pour Chef de Groupe)
    if (type === 'group') {
      const variables = {
        type_risque_principal: opts?.dominante ?? "",
        types_risque_secondaires: opts?.secondaryRisks?.length
          ? opts.secondaryRisks.join(", ")
          : "",
        description_situation: situation ?? "",
        contexte_complementaire: opts?.extraContext ?? "",
        doctrine_context: JSON.stringify(DOCTRINE_CONTEXT)
      };

      const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          prompt: {
            id: PROMPT_ID,
            version: "9",
            variables: {
              situation: situation ?? "",
              ...variables
            }
          },
          text: {
            format: {
              type: "text"
            }
          }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('OpenAI API Error Details:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText
        });
        throw new Error(`Erreur lors de l'appel à l'IA: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();

      // Parse new API response format
      let content = '';
      if (data.output && Array.isArray(data.output)) {
        const messageItem = data.output.find((item: any) => item.type === 'message');
        if (messageItem && messageItem.content && Array.isArray(messageItem.content)) {
          const textItem = messageItem.content.find((c: any) => c.type === 'output_text');
          if (textItem) {
            content = textItem.text;
          }
        }
      }

      // Fallback if structure is different
      if (!content) {
        content = data.output || data.content || (data.choices && data.choices[0]?.message?.content) || JSON.stringify(data);
      }

      return content;
    }

    // ANCIEN MODE: Assistants API (Pour les autres fonctions)

    // Fallback: direct client call (not recommended for production)
    const openai = new OpenAI({
      apiKey: apiKey,
      dangerouslyAllowBrowser: true
    });

    // Create a thread
    const thread = await openai.beta.threads.create();

    // Add a message to the thread
    await openai.beta.threads.messages.create(thread.id, {
      role: "user",
      content: situation
    });

    // Run the assistant
    const assistantId = (ASSISTANT_IDS as any)[type] || ASSISTANT_IDS.group;
    const run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: assistantId
    });

    // Wait for the run to complete with timeout (60s)
    const start = Date.now();
    let runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
    while (runStatus.status !== 'completed') {
      if (runStatus.status === 'failed') {
        throw new Error('L\'analyse a échoué. Veuillez réessayer.');
      }
      if (Date.now() - start > 60000) {
        throw new Error('Délai dépassé pour l\'analyse. Veuillez réessayer.');
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
      runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
    }

    // Get the messages
    const messages = await openai.beta.threads.messages.list(thread.id);
    const assistantMessage = messages.data.find(m => m.role === 'assistant');
    const contentParts = assistantMessage?.content?.filter((c: any) => c.type === 'text') || [];
    const content = contentParts.map((c: any) => c.text?.value || '').join('\n').trim();

    if (!content) {
      throw new Error('Invalid response format from AI');
    }

    return content;

  } catch (error: any) {
    console.error('Error analyzing emergency:', error);
    throw new Error(error.message || 'Erreur lors de l\'analyse de la situation d\'urgence.');
  }
};
