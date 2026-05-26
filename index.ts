import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { experimental_generateVideo as generateVideo } from 'ai';

dotenv.config({ path: '.env.local' });

const outputDir = path.join(process.cwd(), 'media', 'generated');
const outputPath = path.join(outputDir, 'ai-gateway-video.mp4');

const prompt =
  process.argv.slice(2).join(' ').trim() ||
  'A cinematic tracking shot of a sleek video editing studio interface coming alive with glowing timeline clips, polished lighting, and subtle camera movement';

async function main() {
  if (!process.env.AI_GATEWAY_API_KEY && !process.env.VERCEL_OIDC_TOKEN) {
    throw new Error(
      'Missing AI Gateway auth. Add AI_GATEWAY_API_KEY to .env.local or refresh VERCEL_OIDC_TOKEN with `vercel env pull .env.local`.',
    );
  }

  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  console.log('Generating video with google/veo-3.1-generate-001...');

  const result = await generateVideo({
    model: 'google/veo-3.1-generate-001',
    prompt,
    aspectRatio: '16:9',
    duration: 8,
    resolution: '1280x720',
  });

  const video = result.videos[0];

  if (!video) {
    throw new Error('The model did not return a video.');
  }

  writeFileSync(outputPath, video.uint8Array);

  console.log(`Video saved to ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
