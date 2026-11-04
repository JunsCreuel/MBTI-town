import { currentUser } from '@/server/auth';
import { handle, readJson } from '@/server/http';
import { getSceneService } from '@/server/scene';
import { fetchVideo } from '@/server/youtube';

export const dynamic = 'force-dynamic';

/** 클럽 유튜브 신청 (운영자만): 켜기·끄기, 막은 영상·채널 */
export async function GET() {
  return handle(async () => (await getSceneService()).adminYoutube(await currentUser()));
}

/** { on: boolean } | { block: { url, scope: 'video' | 'channel' } } | { unblock: { kind, id } } */
export async function POST(request: Request) {
  return handle(async () =>
    (await getSceneService()).adminYoutubeUpdate(await currentUser(), await readJson(request), async (id) => {
      const item = await fetchVideo(id);
      const sn = item?.snippet;
      return sn ? { title: sn.title ?? '', channelId: sn.channelId ?? '', channelTitle: sn.channelTitle ?? '' } : null;
    }),
  );
}
