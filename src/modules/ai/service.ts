import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { Output } from "ai";

export const aiResponseSchema = z.object({
  action: z.enum(["DRAFT_CREATED", "OPTIMIZATION_SUGGESTED", "TRIAGE_REQUIRED"]),
  summary: z.string(),
  data: z.object({
    new_activities: z.array(
      z.object({
        title: z.string(),
        start: z.string(),
        end: z.string(),
        is_fixed: z.boolean(),
        category: z.enum(["deep_work", "admin", "health", "social"]),
        priority: z.number().min(1).max(5),
      })
    ),
    shifted_activities: z.array(z.object({
      title: z.string(),
      start: z.string(),
      end: z.string(),
      is_fixed: z.boolean(),
      category: z.string(),
      priority: z.number(),
    })),
    alternative_slots: z.array(z.object({
      start: z.string(),
      end: z.string(),
    })),
  }),
  ai_reasoning: z.string(),
});

export type AIProposal = z.infer<typeof aiResponseSchema>;

export interface ScheduleContext {
  title: string;
  startTime: string;
  endTime: string;
  isFixed: boolean;
  priority: number;
  category: string;
}

export function buildSystemPrompt(
  currentTime: string,
  userBuffer: number,
  sleepStart: string,
  existingSchedules: ScheduleContext[]
): string {
  return `# IDENTITY
Anda adalah "Dynamic Buffer Engine", asisten manajemen waktu yang empatik, proaktif, dan logis. Tugas Anda bukan hanya menjadwalkan tugas, tetapi membantu pengguna mengelola energi mereka menggunakan metode Time Blocking.

# CORE PHILOSOPHY
- Waktu adalah terbatas, tetapi energi manusia lebih terbatas lagi.
- Istirahat (Buffer) bukanlah waktu yang terbuang, melainkan investasi produktivitas.
- Lindungi jadwal tetap (Fixed) seolah-olah itu adalah janji suci.
- Berikan saran yang mendukung, bukan mendikte.

# INPUT CONTEXT
- current_time: ${currentTime} (UTC)
- user_buffer: ${userBuffer} menit
- user_sleep_start: ${sleepStart} (AI akan memberi peringatan jika ada kegiatan di waktu tidur)
- existing_schedules: ${JSON.stringify(existingSchedules)}

# OPERATIONAL RULES
1. **Normalization**: Ubah input bahasa alami (misal: "nanti sore", "besok jam 10") menjadi format ISO-8601 UTC.
2. **Buffer Policy**: Selalu sisipkan ${userBuffer} menit antar kegiatan. Untuk kategori 'deep_work', berikan buffer minimal 15 menit.
3. **Conflict Resolution**: Jika menabrak FIXED: cari slot kosong. Jika menabrak FLEXIBLE: geser jadwal fleksibel, minimal buffer 5 menit.
4. **Triage Logic**: Jika hari penuh, sarankan pindahkan tugas prioritas rendah ke esok.
5. **Burnout Alert**: Jika >3 jam kerja tanpa jeda, sisipkan "Short Break".

# TONE
Gunakan bahasa tenang, mendukung, tidak menghakimi. Selalu berikan ai_reasoning yang menjelaskan manfaat perubahan.`;
}

export abstract class AIService {
  static async processPrompt(
    userPrompt: string,
    context: {
      currentTime: string;
      bufferMinutes: number;
      sleepStart: string;
      existingSchedules: ScheduleContext[];
    }
  ): Promise<AIProposal> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is not set");
    }

    const systemPrompt = buildSystemPrompt(
      context.currentTime,
      context.bufferMinutes,
      context.sleepStart,
      context.existingSchedules
    );

    const { output } = await generateText({
      model: openai("gpt-4o"),
      system: systemPrompt,
      prompt: userPrompt,
      output: Output.object({
        schema: aiResponseSchema,
        name: "ScheduleProposal",
        description: "Jadwal yang diusulkan AI untuk dikonfirmasi user",
      }),
    });

    return output as AIProposal;
  }
}
