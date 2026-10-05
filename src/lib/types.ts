export interface Macronutrients {
  proteins_g: number;
  fats_g: number;
  carbs_g: number;
}

export type Verdict = "Рекомендуется" | "С осторожностью" | "Не рекомендуется";

export interface FoodAnalysisResult {
  is_food: boolean;
  food_name: string;
  estimated_weight_g: number;
  calories: number;
  macronutrients: Macronutrients;
  recommendation_verdict: Verdict;
  short_advice: string;
}

export interface AnalyzeError {
  error: string;
  details?: string;
}
