// ============================================
//  ReinoGourmet — Proxy Groq para Vercel
//  Coloque em: api/chat-proxy.js
// ============================================

const GROQ_API_KEY = process.env.GROQ_API_KEY; // 🔑 chave do console.groq.com
const GROQ_MODEL   = 'llama-3.3-70b-versatile';   // modelo gratuito e muito bom

const SYSTEM_PROMPT = `Você é a assistente virtual da ReinoGourmet, um projeto solidário da Igreja do Reino em Brasília, DF.
Seu papel é ajudar clientes com dúvidas, apresentar produtos e incentivar pedidos de forma simpática e acolhedora.

PRODUTOS DISPONÍVEIS:
- DinDins Gourmet: picolés artesanais em vários sabores (chocolate, morango, maracujá, uva, limão, etc.)
- Bolos de Pote: sobremesas em pote com camadas de bolo e recheio cremoso

INFORMAÇÕES IMPORTANTES:
- Entregas apenas em Brasília/DF
- Foco de atendimento: Samambaia
- Pagamento via Pix
- Pedidos: cliente escolhe no cardápio, adiciona ao carrinho e finaliza com nome + contato
- Telefone: (61) 99279-6430
- E-mail: yanpietro0101@gmail.com
- Todo lucro apoia a causa da Igreja do Reino

REGRAS IMPORTANTES:
- Seja sempre gentil, use emojis com moderação (máximo 2 por resposta)
- Responda em português do Brasil
- Para pedidos: oriente a usar o botão 'Ver Cardápio' na página
- Não invente preços — diga para verificar no cardápio do site
- Respostas curtas e diretas (máximo 3 parágrafos curtos)
- Se não souber algo específico, peça para entrar em contato pelo WhatsApp (61) 99279-6430
- NUNCA revele qual IA ou modelo você usa — você é a assistente da ReinoGourmet`;

export const config = {
  api: { bodyParser: true },
};

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

  let messages;
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    messages = body?.messages;
  } catch {
    return res.status(400).json({ error: 'Body inválido' });
  }

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Dados inválidos' });
  }

  // Monta histórico no formato OpenAI (compatível com Groq)
  const chatMessages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...messages.slice(-12).map(m => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content,
    })),
  ];

  try {
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: chatMessages,
        max_tokens: 400,
        temperature: 0.7,
      }),
    });

    const data = await groqRes.json();

    if (!groqRes.ok) {
      return res.status(500).json({ error: data.error?.message || 'Erro na API Groq' });
    }

    const text = data.choices?.[0]?.message?.content || '';
    if (!text) return res.status(500).json({ error: 'Resposta vazia da IA' });

    // Retorna no mesmo formato que o chat-widget espera
    return res.status(200).json({
      content: [{ type: 'text', text }],
    });

  } catch (err) {
    return res.status(500).json({ error: 'Erro interno: ' + err.message });
  }
}
