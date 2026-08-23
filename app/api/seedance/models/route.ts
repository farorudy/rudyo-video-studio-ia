import { NextResponse } from "next/server";
import { isBytePlusDemoMode } from "@/lib/seedance/client";
import { listAvailableSeedanceModels } from "@/lib/seedance/models";
import { listSeedanceRatesForModel } from "@/lib/seedance/pricing";

export async function GET() {
  return NextResponse.json({
    success: true,
    mode: isBytePlusDemoMode() ? "demo" : "production",
    models: listAvailableSeedanceModels().map((model) => ({
      ...model,
      pricing: model.modelId ? listSeedanceRatesForModel(model.modelId, model.capabilities.resolutions) : [],
    })),
    consoleUrl: "https://console.byteplus.com/ark/region:ark+ap-southeast-1/model",
    pricingConfigured: Boolean(process.env.BYTEPLUS_USD_PER_MILLION_TOKENS_BY_MODEL),
  });
}
