import { GoogleGenAI, Type } from "@google/genai";
import { ResumeData } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export async function parseResumeWithAI(fileBase64: string, mimeType: string): Promise<Partial<ResumeData>> {
  const prompt = `
    Extract resume information from this file (PDF or Image).
    Return the data in a structured JSON format matching this schema:
    {
      "name": "string",
      "title": "string",
      "contact": { "tel": "string", "email": "string", "blog": "string" },
      "education": [{ "school": "string", "major": "string", "degree": "string", "duration": "string", "college": "string" }],
      "skills": ["string"],
      "workExperience": [{ "title": "string", "duration": "string", "projects": [{ "name": "string", "points": ["string"] }] }],
      "socialProjects": ["string"],
      "selfEvaluation": ["string"]
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          parts: [
            { inlineData: { data: fileBase64, mimeType } },
            { text: prompt }
          ]
        }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            title: { type: Type.STRING },
            contact: {
              type: Type.OBJECT,
              properties: {
                tel: { type: Type.STRING },
                email: { type: Type.STRING },
                blog: { type: Type.STRING }
              }
            },
            education: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  school: { type: Type.STRING },
                  major: { type: Type.STRING },
                  degree: { type: Type.STRING },
                  duration: { type: Type.STRING },
                  college: { type: Type.STRING }
                }
              }
            },
            skills: { type: Type.ARRAY, items: { type: Type.STRING } },
            workExperience: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  duration: { type: Type.STRING },
                  projects: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        name: { type: Type.STRING },
                        points: { type: Type.ARRAY, items: { type: Type.STRING } }
                      }
                    }
                  }
                }
              }
            },
            socialProjects: { type: Type.ARRAY, items: { type: Type.STRING } },
            selfEvaluation: { type: Type.ARRAY, items: { type: Type.STRING } }
          }
        }
      }
    });

    const data = JSON.parse(response.text || "{}");
    return data;
  } catch (error) {
    console.error("AI Parsing Error:", error);
    throw error;
  }
}
