// Yield a real event-loop task so workers can receive stop messages, without
// the timer clamping of repeated setTimeout(0) calls (notably on Windows).
type HostPort = MessagePort & { ref?: () => void; unref?: () => void };
let channel: MessageChannel | undefined;
const waiting: Array<() => void> = [];

export function yieldToHost(): Promise<void> {
  const immediate=(globalThis as typeof globalThis & {setImmediate?: (callback:()=>void)=>unknown}).setImmediate;
  if(immediate)return new Promise(resolve=>immediate(resolve));
  if(typeof MessageChannel==='undefined')return new Promise(resolve=>setTimeout(resolve,0));
  if(!channel) {
    channel=new MessageChannel();
    channel.port1.onmessage=()=>{
      waiting.shift()?.();
      if(!waiting.length)(channel!.port1 as HostPort).unref?.();
    };
    (channel.port1 as HostPort).unref?.();
    (channel.port2 as HostPort).unref?.();
  }
  return new Promise(resolve=>{
    waiting.push(resolve);
    (channel!.port1 as HostPort).ref?.();
    channel!.port2.postMessage(null);
  });
}
