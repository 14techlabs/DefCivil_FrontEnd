import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const GROQ_TRANSCRIPTION_URL = "https://api.groq.com/openai/v1/audio/transcriptions";
const MAX_AUDIO_SIZE = 25 * 1024 * 1024; // 25 mb limite maximo do groq whisper

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Chave de API do serviço de transcrição (GROQ_API_KEY) não configurada no servidor." },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const audioFile = formData.get("file");

    if (!audioFile || !(audioFile instanceof Blob)) {
      return NextResponse.json(
        { error: "Nenhum arquivo de áudio válido foi enviado." },
        { status: 400 }
      );
    }

    if (audioFile.size > MAX_AUDIO_SIZE) {
      return NextResponse.json(
        { error: "O arquivo de áudio excede o limite de 25 MB." },
        { status: 413 }
      );
    }

    // monta o payload multipart para a api do groq whisper
    const groqFormData = new FormData();
    const originalName = audioFile instanceof File && audioFile.name ? audioFile.name : "audio.webm";
    groqFormData.append("file", audioFile, originalName);
    groqFormData.append("model", "whisper-large-v3");
    groqFormData.append("language", "pt");
    groqFormData.append("response_format", "json");
    groqFormData.append("temperature", "0");

    const groqResponse = await fetch(GROQ_TRANSCRIPTION_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: groqFormData,
    });

    if (!groqResponse.ok) {
      const errorText = await groqResponse.text();
      let detail = "Falha ao processar o áudio.";
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.error?.message) {
          detail = errorJson.error.message;
        }
      } catch {
        // mantem o detalhe padrao se nao for json
      }

      if (groqResponse.status === 429) {
        return NextResponse.json(
          { error: "Limite de uso do serviço de transcrição atingido. Tente novamente em instantes." },
          { status: 429 }
        );
      }

      if (groqResponse.status === 401) {
        return NextResponse.json(
          { error: "Chave da API do Groq inválida ou expirada." },
          { status: 502 }
        );
      }

      return NextResponse.json(
        { error: `Erro na transcrição: ${detail}` },
        { status: groqResponse.status }
      );
    }

    const result = await groqResponse.json();
    return NextResponse.json({ text: result.text || "" }, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro interno ao transcrever o áudio.";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
