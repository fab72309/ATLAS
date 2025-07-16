import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true
});

const ASSISTANT_IDS = {
  group: 'asst_Bsocyc9ni7fjeReaEBBsHCzi',
  column: 'asst_Uk4muOm9jLF3TWsYY2n0dxSI',
  communication: 'asst_Hc0fc9SD87L763ZIMDVeNWzQ'
} as const;

export const analyzeEmergency = async (situation: string, type: 'group' | 'column' | 'communication') => {
  try {
    // Create a thread
    const thread = await openai.beta.threads.create();
    
    // Add a message to the thread
    await openai.beta.threads.messages.create(thread.id, {
      role: "user",
      content: situation
    });
    
    // Run the assistant
    const run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: ASSISTANT_IDS[type]
    });
    
    // Wait for the run to complete
    let runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
    while (runStatus.status !== 'completed') {
      if (runStatus.status === 'failed') {
        throw new Error('L\'analyse a échoué. Veuillez réessayer.');
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
      runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
    }
    
    // Get the messages
    const messages = await openai.beta.threads.messages.list(thread.id);
    const lastMessage = messages.data[0];
    const content = lastMessage.content[0].type === 'text' ? lastMessage.content[0].text.value : '';
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