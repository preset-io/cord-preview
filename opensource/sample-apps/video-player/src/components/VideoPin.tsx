import {
  useContext,
  useState,
  useCallback,
  useMemo,
  useEffect,
  useRef,
} from 'react';
import { thread, Pin, Thread } from '@cord-sdk/react';
import type { Location } from '@cord-sdk/types';
import cx from 'classnames';
import type { ThreadMetadata } from '../ThreadsContext';
import { ThreadsContext } from '../ThreadsContext';
import { SAMPLE_GROUP_ID } from './VideoPlayer';

// Control how long should a pin stay on the video, before
// moving back to the controls.
const PIN_TIME_ON_VIDEO_SECONDS = 3;
export function isPinWithinInterval(pinTimestamp: number, currentTime: number) {
  return Math.abs(pinTimestamp - currentTime) <= PIN_TIME_ON_VIDEO_SECONDS / 2;
}

/**
 * A Pin which is either: over the video, exactly where the comment was added,
 * or on the controls, again matching the timestamp of the comment.
 * When the video plays, and the timestamp approaches a Pin, the Pin
 * gets moved over the video. After a fixed amount of time (PIN_TIME_ON_VIDEO),
 * the Pin will move back to the controls.
 */
export function VideoPin({
  id,
  metadata,
  location,
  currentTime,
  duration,
}: {
  id: string;
  metadata: ThreadMetadata;
  location: Location;
  currentTime: number;
  duration: number;
}) {
  const { threads, removeThread, openThread, setOpenThread, allowAutofocus } =
    useContext(ThreadsContext)!;

  // When hovering on a Pin on the controls, we show a preview of the first
  // message of that thread.
  const [showThreadPreviewBubble, setThreadShowPreviewBubble] = useState(false);

  // Whether the pin should be displayed on the controls, as opposed to
  // on the video itself.
  const displayOnControls = useCallback(
    (threadMetadata: ThreadMetadata) => {
      return (
        !isPinWithinInterval(threadMetadata.timestamp, currentTime) &&
        openThread !== id
      );
    },
    [currentTime, openThread, id],
  );

  // Usually, we'll keep a pin on screen for a fixed, short amount of time.
  // But some Pins we want to keep around for longer.
  // NOTE: This code exists just to support some cool interactions on Cord.com's demos.
  const isPersistingPin = useMemo(() => {
    // Special case for threads with extra metadata
    return (
      metadata.autogenerated &&
      metadata.durationOnVideo &&
      Math.floor(currentTime) >= metadata.timestamp &&
      Math.floor(currentTime) <= metadata.timestamp + metadata.durationOnVideo
    );
  }, [
    currentTime,
    metadata.autogenerated,
    metadata.durationOnVideo,
    metadata.timestamp,
  ]);

  const onPinClick = useCallback(() => {
    const isOpenThreadEmpty =
      openThread && threads.get(openThread)?.totalMessages === 0;

    if (isOpenThreadEmpty) {
      removeThread(openThread);
    }

    // Clicking on the openThread's pin will close the thread.
    if (openThread === id) {
      setOpenThread(null);
      return;
    }

    setOpenThread(id);
    const video = document.querySelector('video');

    if (!(video instanceof HTMLVideoElement)) {
      return;
    }

    // Want to pause the video without moving the video frame when a user
    // clicks on a pin that is on the video
    if (displayOnControls(metadata) && !isPersistingPin) {
      video.currentTime = metadata.timestamp;
    }
    video.pause();
  }, [
    openThread,
    threads,
    id,
    setOpenThread,
    displayOnControls,
    metadata,
    isPersistingPin,
    removeThread,
  ]);

  // The position of the Pins on the video are controlled by these
  // CSS variables.
  const getPinCSSVariables = useCallback(
    (threadMetadata: ThreadMetadata): React.CSSProperties | undefined => {
      if (!duration) {
        return undefined;
      }
      return {
        '--pin-x-percent': `${threadMetadata.xPercent}%`,
        '--pin-y-percent': `${threadMetadata.yPercent}%`,
        '--pin-time-ratio': `${threadMetadata.timestamp / duration}`,
      } as React.CSSProperties;
    },
    [duration],
  );

  const { thread: threadData } = thread.useThread(id);
  // Special code to make the thread auto open based on timestamp
  // NOTE: This code exists just to support some cool interactions on Cord.com's demos.
  const didForceOpenRef = useRef(false);
  useEffect(() => {
    if (!metadata.initallyOpen || didForceOpenRef.current) {
      return;
    }
    setOpenThread(id);
    didForceOpenRef.current = true;
  }, [id, metadata.initallyOpen, setOpenThread]);

  // The classname determines where the pin will be rendered.
  const pinClassname = useMemo(() => {
    // Some staged threads we want to extend the pin time on the video
    if (isPersistingPin && openThread !== id) {
      return 'pin-on-video-pulse';
    }

    if (displayOnControls(metadata)) {
      return 'pin-on-control';
    }

    // Some staged threads we want to add a pulse animation to
    if (metadata.autogenerated && !metadata.initallyOpen && openThread !== id) {
      return 'pin-on-video-pulse';
    }

    return 'pin-on-video';
  }, [displayOnControls, id, isPersistingPin, metadata, openThread]);

  return (
    <Pin
      location={location}
      threadId={id}
      style={getPinCSSVariables(metadata)}
      className={cx(
        pinClassname,
        // Position thread based on which half of the video the pin sits in
        { ['thread-on-the-left']: metadata.xPercent > 50 },
        { ['thread-on-the-top']: metadata.yPercent > 50 },
      )}
      onClick={onPinClick}
      onMouseEnter={() => setThreadShowPreviewBubble(true)}
      onMouseLeave={() => setThreadShowPreviewBubble(false)}
    >
      {showThreadPreviewBubble &&
        displayOnControls(metadata) &&
        threadData?.firstMessage?.plaintext && (
          <div className="thread-preview-bubble-container">
            <p className="thread-preview-bubble">
              {threadData.firstMessage.plaintext}
            </p>
          </div>
        )}
      <Thread
        groupId={SAMPLE_GROUP_ID}
        threadId={id}
        metadata={metadata}
        location={location}
        onResolved={() => removeThread(id)}
        showPlaceholder={false}
        autofocus={allowAutofocus && openThread === id}
        className={cx({ ['open-thread']: openThread === id })}
      />
    </Pin>
  );
}
