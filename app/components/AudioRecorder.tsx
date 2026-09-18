"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Btn, Icon, StatusDot } from "@/app/components/Primitives";

interface AudioRecorderProps {
  onTranscription: (text: string) => void;
  disabled?: boolean;
  className?: string;
}

const MAX_RECORDING_SECONDS = 90; // limite de 90 segundos para gravacao de relato

export function AudioRecorder({
  onTranscription,
  disabled = false,
  className = "",
}: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // limpa os recursos de audio e temporizador
  const cleanupRecording = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    mediaRecorderRef.current = null;
    audioChunksRef.current = [];
    setIsRecording(false);
    setDurationSeconds(0);
  }, []);

  // garante que as faixas de audio sejam encerradas ao desmontar
  useEffect(() => {
    return () => {
      cleanupRecording();
    };
  }, [cleanupRecording]);

  // formata segundos em MM:SS
  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  // envia o blob gravado para a rota de transcricao do groq
  const sendAudioForTranscription = async (blob: Blob, mimeType: string) => {
    setIsTranscribing(true);
    setErrorMessage(null);

    try {
      const ext = mimeType.includes("mp4")
        ? "mp4"
        : mimeType.includes("ogg")
        ? "ogg"
        : mimeType.includes("wav")
        ? "wav"
        : "webm";

      const formData = new FormData();
      formData.append("file", blob, `relato.${ext}`);

      // chamada a rota do next.js no mesmo host
      const response = await fetch("/api/transcribe", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erro ao processar o áudio.");
      }

      const transcribedText = (data.text || "").trim();
      if (transcribedText) {
        onTranscription(transcribedText);
      } else {
        setErrorMessage("Nenhuma fala detectada no áudio.");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Falha na transcrição do áudio.";
      setErrorMessage(message);
    } finally {
      setIsTranscribing(false);
    }
  };

  // interrompe a gravacao e aciona o onstop
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
  }, []);

  // cancela a gravacao sem transcrever
  const cancelRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.onstop = null;
      if (mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
    }
    cleanupRecording();
  };

  // inicia a gravacao do microfone
  const startRecording = async () => {
    setErrorMessage(null);

    if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setErrorMessage("Seu navegador não possui suporte à gravação de áudio.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // seleciona formato compativel com o navegador
      const mimeTypes = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
        "audio/ogg;codecs=opus",
        "audio/wav",
      ];
      const supportedType = mimeTypes.find((t) => MediaRecorder.isTypeSupported(t)) || "";
      const options = supportedType ? { mimeType: supportedType } : undefined;

      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const chunks = audioChunksRef.current;
        const mime = mediaRecorder.mimeType || supportedType || "audio/webm";

        // limpa o microfone imediatamente
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        setIsRecording(false);
        setDurationSeconds(0);

        if (chunks.length === 0) {
          return;
        }

        const audioBlob = new Blob(chunks, { type: mime });
        await sendAudioForTranscription(audioBlob, mime);
      };

      mediaRecorder.start(250);
      setIsRecording(true);
      setDurationSeconds(0);

      // contador de tempo com parada automatica ao atingir limite
      const startTime = Date.now();
      timerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        setDurationSeconds(elapsed);
        if (elapsed >= MAX_RECORDING_SECONDS) {
          stopRecording();
        }
      }, 500);
    } catch (err: unknown) {
      cleanupRecording();
      const errName = err instanceof Error ? err.name : "";
      if (errName === "NotAllowedError" || errName === "PermissionDeniedError") {
        setErrorMessage("Permissão de microfone negada. Habilite o acesso nas configurações do navegador.");
      } else if (errName === "NotFoundError" || errName === "DevicesNotFoundError") {
        setErrorMessage("Nenhum dispositivo de microfone encontrado.");
      } else {
        setErrorMessage("Não foi possível acessar o microfone.");
      }
    }
  };

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <div className="flex flex-wrap items-center gap-2">
        {!isRecording && !isTranscribing && (
          <Btn
            variant="secondary"
            icon="mic"
            disabled={disabled}
            onClick={startRecording}
            className="text-xs py-1.5 px-3"
          >
            Gravar relato
          </Btn>
        )}

        {isRecording && (
          <div className="flex items-center gap-2 bg-surface-container-high px-3 py-1.5 rounded-lg border border-secondary/20">
            <StatusDot tone="error" live={true} />
            <span className="text-xs font-mono font-bold text-on-surface">
              {formatTime(durationSeconds)} / {formatTime(MAX_RECORDING_SECONDS)}
            </span>
            <Btn
              variant="primary"
              icon="check"
              onClick={stopRecording}
              className="text-xs py-1 px-2.5 ml-1"
            >
              Concluir
            </Btn>
            <Btn
              variant="ghostDark"
              icon="close"
              onClick={cancelRecording}
              className="text-xs py-1 px-2"
            >
              Cancelar
            </Btn>
          </div>
        )}

        {isTranscribing && (
          <div className="flex items-center gap-2 bg-surface-container-high px-3 py-1.5 rounded-lg text-xs font-medium text-on-surface-variant border border-surface-container-highest">
            <Icon name="progress_activity" className="text-[16px] animate-spin text-secondary" />
            <span>Transcrevendo áudio com IA…</span>
          </div>
        )}
      </div>

      {errorMessage && (
        <div className="flex items-center gap-1.5 text-xs text-error font-medium bg-error/10 px-2.5 py-1.5 rounded-md">
          <Icon name="error" className="text-[16px] shrink-0" />
          <span className="flex-1">{errorMessage}</span>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-on-surface-variant hover:text-on-surface p-0.5"
            aria-label="Fechar erro"
          >
            <Icon name="close" className="text-[14px]" />
          </button>
        </div>
      )}
    </div>
  );
}
