import OpenAI from 'openai';
import { auth } from './firebase';

const ASSISTANT_IDS = {
  group: 'asst_Bsocyc9ni7fjeReaEBBsHCzi',
  column: 'asst_Uk4muOm9jLF3TWsYY2n0dxSI',
  site: 'asst_Bsocyc9ni7fjeReaEBBsHCzi',
  communication: 'asst_Hc0fc9SD87L763ZIMDVeNWzQ'
} as const;

export const analyzeEmergency = async (situation: string, type: 'group' | 'column' | 'site' | 'communication') => {
  try {
    // Prefer calling a server-side proxy if available
    const proxyUrl = import.meta.env.VITE_OPENAI_PROXY_URL || '/api/analyze';
    if (import.meta.env.VITE_OPENAI_PROXY_URL) {
      let authHeader: Record<string, string> = {};
      try {
        const token = await auth.currentUser?.getIdToken?.();
        if (token) authHeader = { Authorization: `Bearer ${token}` };
      } catch {}
      const response = await fetch(proxyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify({ situation, type, response_format: 'json' })
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || 'Erreur serveur lors de l\'analyse.');
      }
      const data = await response.json();
      // Expect data.result to be string; could be JSON string
      return typeof data.result === 'string' ? data.result : JSON.stringify(data.result);
    }

    // Fallback: direct client call (not recommended for production)
    const openai = new OpenAI({
      apiKey: import.meta.env.VITE_OPENAI_API_KEY,
      dangerouslyAllowBrowser: true
    });
    // Create a thread
    const thread = await openai.beta.threads.create();
    
    // Add a message to the thread
    await openai.beta.threads.messages.create(thread.id, {
      role: "user",
      content: situation
    });
    
    // Run the assistant (fallback on group if type unsupported)
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
    
  } catch (error) {
    console.error('Error analyzing emergency:', error);
    if (error?.error?.code === 'insufficient_quota') {
      throw new Error('Le quota d\'utilisation de l\'IA a été dépassé. Veuillez réessayer plus tard.');
    }
    throw new Error(error.message || 'Erreur lors de l\'analyse de la situation d\'urgence.');
  }
};