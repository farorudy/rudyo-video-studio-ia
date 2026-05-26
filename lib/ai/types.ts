export type AIMode = "creative" | "expert" | "sovereign";
export type ContentType = "storyboard" | "script" | "prompt" | "project";
export type VisualStyle =
  | "cinéma"
  | "documentaire"
  | "animation"
  | "motion-design"
  | "corporate";
export type Tone =
  | "professionnel"
  | "ludique"
  | "dramatique"
  | "informatif"
  | "inspirant";

export interface GenerateRequest {
  mode: AIMode;
  contentType: ContentType;
  topic: string;
  objective?: string;
  targetAudience?: string;
  duration?: number;
  format?: "vertical" | "horizontal" | "square";
  style?: VisualStyle;
  tone?: Tone;
  language?: string;
  customInstructions?: string;
  budget?: "economy" | "standard" | "premium";
}

export interface AIResponse {
  success: boolean;
  mode: AIMode;
  provider: string;
  content: StoryboardJSON;
  tokensUsed?: number;
  timestamp: string;
}

export interface StoryboardJSON {
  project: {
    title: string;
    objective: string;
    targetAudience: string;
    recommendedDuration: number;
    recommendedFormat: string;
    visualStyle: string;
    tone: string;
    language: string;
    createdAt: string;
    aiMode: AIMode;
    aiProvider: string;
  };
  scenes: Scene[];
  metadata: {
    totalDuration: number;
    sceneCount: number;
    requirements: string[];
    importedElements: ImportedElement[];
  };
}

export interface Scene {
  id: number;
  title: string;
  description: string;
  duration: number;
  onScreenText: string;
  voiceOver: string;
  soundscape: string;
  cameraMovement: string;
  transition: string;
  visualPrompt: string;
  videoPrompt: string;
  notes?: string;
}

export interface ImportedElement {
  type: "music" | "sound" | "image" | "video" | "font" | "graphic";
  name: string;
  description: string;
  suggestedSource?: string;
}

export interface AIError {
  code: string;
  message: string;
  provider?: string;
  timestamp: string;
}
