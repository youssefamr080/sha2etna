import { GoogleGenAI, Type } from "@google/genai";

// Vite exposes env vars via import.meta.env, not process.env
const apiKey = (import.meta.env.VITE_GEMINI_API_KEY as string) || '';
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

const ensureAI = (): GoogleGenAI => {
  if (!ai) {
    throw new Error('Gemini API key is not configured. Set VITE_GEMINI_API_KEY in your .env file.');
  }
  return ai;
};

interface ReceiptData {
  amount: number;
  vendor: string;
  date: string;
  category: string;
  notes?: string;
}

export const scanReceipt = async (base64Image: string): Promise<ReceiptData | null> => {
  try {
    const response = await ensureAI().models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: base64Image
            }
          },
          {
            text: `قم بتحليل هذا الإيصال/الفاتورة بدقة واستخرج المعلومات التالية:
1. المبلغ الإجمالي (رقم فقط)
2. اسم المتجر أو البائع أو نوع الخدمة
3. التاريخ بصيغة YYYY-MM-DD (إذا غير موجود استخدم تاريخ اليوم)
4. صنف المصروف إلى واحدة من الفئات التالية بالإنجليزية: Rent, Utilities, Groceries, Internet, Electricity, Water, Gas, Entertainment, Food, Transportation, Maintenance, Other
5. أي ملاحظات مهمة (مثل رقم الفاتورة أو تفاصيل إضافية)

أعد النتيجة كملف JSON.`
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            amount: { type: Type.NUMBER },
            vendor: { type: Type.STRING },
            date: { type: Type.STRING },
            category: { type: Type.STRING },
            notes: { type: Type.STRING }
          },
          required: ["amount", "vendor", "category"]
        }
      }
    });

    const text = response.text;
    if (!text) return null;
    return JSON.parse(text) as ReceiptData;

  } catch {
    return null;
  }
};

export const transcribeAudio = async (base64Audio: string): Promise<string> => {
  try {
    const response = await ensureAI().models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: "audio/webm",
              data: base64Audio
            }
          },
          {
            text: "قم بتحويل هذا الصوت إلى نص باللغة العربية. اكتب بالضبط ما يُقال."
          }
        ]
      }
    });
    return response.text || "";
  } catch {
    return "";
  }
};