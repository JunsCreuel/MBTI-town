import { createRealtimeServer } from './app';
import { townRoomCapacity } from './rooms/TownRoom';

const port = Number(process.env.PORT) || 2567;
const server = createRealtimeServer();
await server.listen(port);
console.log(`실시간 서버: ws://localhost:${port} (채널당 정원 ${townRoomCapacity()}명${process.env.REDIS_URL ? ', Redis 사용' : ''})`);
