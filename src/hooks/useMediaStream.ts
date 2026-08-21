/**
 * Re-exports the shared media stream store so all existing import paths
 * (`@/hooks/useMediaStream`) continue to work unchanged.
 *
 * The stream now persists across route changes (/setup → /tasks → /assessment)
 * because state lives in the module-level store in @/lib/als/mediaStreamStore.
 *
 * Stopping tracks is explicit (call stopAll()), not implicit on unmount.
 */
export {
  useMediaStream,
  enableCamera,
  enableMic,
  stopAll,
  type PermState,
} from "@/lib/als/mediaStreamStore";
