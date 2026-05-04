// ============================================
//  ReinoGourmet — Proxy Gemini para Vercel
//  Coloque em: api/chat-proxy.js
// ============================================

const GEMINI_API_KEY = 'AIzaSyBElfhu5Pl7Msx0GocLQv0EwbKCKViRWts'; // 🔑 cole sua chave aqui
const GEMINI_MODEL   = 'gemini-1.5-flash';

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
- NUNCA diga que é uma IA do Google ou Gemini — você é a assistente da ReinoGourmet`;

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

  const { messages } = req.body;
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Dados inválidos' });
  }

  // Converte histórico para formato Gemini
  const contents = messages.slice(-12).map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  if (!contents.length || contents[0].role !== 'user') {
    return res.status(400).json({ error: 'Histórico inválido' });
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

    const geminiRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents,
        generationConfig: { maxOutputTokens: 400, temperature: 0.7 },
      }),
    });

    const data = await geminiRes.json();

    if (!geminiRes.ok || !data.candidates) {
      return res.status(500).json({ error: data.error?.message || 'Erro na API Gemini' });
    }

    const text = data.candidates[0]?.content?.parts?.[0]?.text || '';
    if (!text) return res.status(500).json({ error: 'Resposta vazia da IA' });

    // Retorna no mesmo formato que o chat-widget.js espera
    return res.status(200).json({
      content: [{ type: 'text', text }],
    });

  } catch (err) {
    return res.status(500).json({ error: 'Erro interno: ' + err.message });
  }
}
