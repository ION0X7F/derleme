import * as cheerio from "cheerio";
import type { ExtractedProductFields } from "@/types/analysis";

export type PlatformExtractorParams = {
  $: cheerio.CheerioAPI;
  html: string;
  url: string;
};

export type PlatformExtractorResult = Partial<ExtractedProductFields>;

export type PlatformExtractor = (
  params: PlatformExtractorParams
) => PlatformExtractorResult;