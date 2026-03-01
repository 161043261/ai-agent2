import { join } from 'path';
import { StructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import ensureDir from './ensure-dir';
import axios from 'axios';
import { writeFile } from 'fs/promises';

const OUTPUT_DIR = join(process.cwd(), './tmp/download');

export class ResourceDownloadTool extends StructuredTool {
  name = ResourceDownloadTool.name;
  description = 'Download resource from url';
  schema = z.object({
    url: z.string().describe('Url of the resource to download'),
    filename: z.string().describe('Downloaded resource filename'),
  });

  async _call(args: { url: string; filename: string }): Promise<string> {
    const { url, filename } = args;
    const filepath = join(OUTPUT_DIR, filename);
    try {
      await ensureDir(OUTPUT_DIR);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const { data } = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 180_000,
      });
      await writeFile(filepath, typeof data === 'string' ? data : String(data));
      return `Resource downloaded successfully to: ${filepath}`;
    } catch (err) {
      console.error('Downloading resource error:', err);
      return 'Downloading resource error';
    }
  }
}
