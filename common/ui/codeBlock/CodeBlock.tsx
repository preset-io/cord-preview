import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createUseStyles } from 'react-jss';
import cx from 'classnames';
import CodeDisplay from 'common/ui/codeBlock/CodeDisplay.tsx';
import SwitchCodeButton, {
  ExpandCodeButton,
} from 'common/ui/switchCodeButton/SwitchCodeButton.tsx';
import { PreferenceContext } from 'common/page_context/PreferenceContext.tsx';
import { fetchSampleToken } from 'common/util/fetchSampleToken.ts';
import { Colors } from 'common/const/Colors.ts';

// Languages and themes to pick from:
// https://react-syntax-highlighter.github.io/react-syntax-highlighter/demo/prism.html
// I'm using Prism rather than the other one because it does better with JSX
// highlighting

type Snippet = {
  language: string;
  snippet: string;
  languageDisplayName: string;
};

type CodeBlockProps = {
  snippetList: Snippet[];
  savePreferenceFor?: 'client' | 'server';
  clip?: boolean;
  onChangeSnippet?: (snippetIndex: number) => void;
  className?: string;
};

const useStyles = createUseStyles({
  container: {
    '& code': {
      padding: 0,
    },
    background: '#2f2f2f',
    position: 'relative',
    borderRadius: '4px',
  },
  codeSwitchButtons: {
    display: 'flex',
    flexDirection: 'row',
    left: 24,
    position: 'absolute',
    top: 24,
  },
  copyButton: {
    backgroundColor: `${Colors.CONTENT_PRIMARY}`,
    borderRadius: '100px',
    bottom: '24px',
    color: 'white',
    cursor: 'pointer',
    fontSize: '14px',
    padding: '8px 16px',
    position: 'absolute',
    right: '24px',
    transition: 'opacity 0.5s, background-color 0.1s',
    '&:hover': {
      backgroundColor: '#fff',
      color: `${Colors.CONTENT_PRIMARY}`,
    },
  },
  copyButtonUsed: {
    backgroundColor: `${Colors.GREEN}`,
    '&:hover': {
      backgroundColor: `${Colors.GREEN}`,
      color: '#fff',
    },
  },
});

function CodeBlock({
  snippetList,
  savePreferenceFor,
  clip = false,
  onChangeSnippet,
  className,
}: CodeBlockProps) {
  const classes = useStyles();

  if (!snippetList || !snippetList.length) {
    throw new Error('Cannot render a CodeBlock with no snippet(s)');
  }

  const [hovered, setHovered] = useState(false);
  const [holdMessage, setHoldMessage] = useState(false);
  const [hasCopied, setHasCopied] = useState(false);

  const preferenceContext = useContext(PreferenceContext);
  const [selectedSnippet, setSelectedSnippet] = useState(0);
  const [sampleToken, setSampleToken] = useState({ token: '', expires: 0 });

  useEffect(() => {
    async function updateSampleToken() {
      if (Date.now() > sampleToken.expires) {
        const token = await fetchSampleToken();
        if (!token) {
          return;
        }
        // Since the tokens expire every 24 hours -- we'll cleverly evade
        // that expiration by setting our expiry one hour sooner. Muahaha.
        setSampleToken({ token, expires: Date.now() + 1000 * 60 * 60 * 23 });
      }
    }

    // Guard against long-lived tabs having stale tokens by refreshing
    // them periodically
    // eslint-disable-next-line @typescript-eslint/no-misused-promises -- Disabling for pre-existing problems. Please do not copy this comment, and consider fixing this one!
    const interval = setInterval(updateSampleToken, 1000 * 60 * 60);
    void updateSampleToken();
    return () => {
      // cleanup timeout
      clearInterval(interval);
    };
  }, [sampleToken, setSampleToken]);

  useEffect(() => {
    if (savePreferenceFor) {
      let snippetIdx: number | undefined = undefined;
      if (savePreferenceFor === 'server') {
        snippetIdx = snippetList.findIndex((snippet) => {
          return (
            snippet.languageDisplayName === preferenceContext.serverLanguage
          );
        });
      } else if (savePreferenceFor === 'client') {
        snippetIdx = snippetList.findIndex((snippet) => {
          return (
            snippet.languageDisplayName === preferenceContext.clientLanguage
          );
        });
      }
      if (snippetIdx !== undefined && snippetIdx !== -1) {
        setSelectedSnippet(snippetIdx);
      }
    }
  }, [snippetList, preferenceContext, setSelectedSnippet, savePreferenceFor]);

  const onHover = useCallback(() => {
    setHovered(true);
  }, [setHovered]);

  const onLeave = useCallback(() => {
    setHovered(false);
    setHoldMessage(false);
    setTimeout(() => {
      setHasCopied(false);
    }, 600); // Just long enough to ensure the transition has occurred
  }, [setHovered, setHasCopied, setHoldMessage]);

  const onChangeSelectedSnippet = useCallback(
    (snippetIdx: number) => {
      if (!snippetList[snippetIdx]) {
        throw new Error(
          'Cannot switch to a language for which there is no code snippet',
        );
      }
      onChangeSnippet?.(snippetIdx);

      if (savePreferenceFor === 'server') {
        preferenceContext.setServerLanguage(
          snippetList[snippetIdx].languageDisplayName,
        );
      } else if (savePreferenceFor === 'client') {
        preferenceContext.setClientLanguage(
          snippetList[snippetIdx].languageDisplayName,
        );
      } else {
        setSelectedSnippet(snippetIdx);
      }
    },
    [
      snippetList,
      setSelectedSnippet,
      preferenceContext,
      savePreferenceFor,
      onChangeSnippet,
    ],
  );

  if (selectedSnippet === undefined) {
    throw new Error('Unexpected state: no selected snippet');
  }

  if (!snippetList[selectedSnippet]) {
    throw new Error("Unexpected state: selected snippet doesn't exist");
  }

  const selectedSnippetSnippet = snippetList[selectedSnippet].snippet;
  const codeString = useMemo(() => {
    const code = selectedSnippetSnippet;
    if (sampleToken.token === '') {
      return code;
    }

    return code.replace('<CLIENT_AUTH_TOKEN>', sampleToken.token);
  }, [sampleToken, selectedSnippetSnippet]);

  const copy = useCallback(() => {
    if (selectedSnippet === undefined || !snippetList.length) {
      return;
    }

    void navigator.clipboard.writeText(codeString);
    setHoldMessage(true);
    setHasCopied(true);
  }, [setHasCopied, setHoldMessage, selectedSnippet, snippetList, codeString]);

  const CLIPPED_MAX_HEIGHT = 400;
  const CONTAINER_PADDING_TOP = 56;
  const CONTAINER_PADDING = 24;
  const [maxHeight, setMaxHeight] = useState(CLIPPED_MAX_HEIGHT);
  const [isClipped, setIsClipped] = useState(clip);
  const [shouldClip, setShouldClip] = useState(clip);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const codeDisplayNode =
    containerRef.current &&
    [...containerRef.current.children].find((child) => child.tagName === 'PRE');

  const codeHeight =
    codeDisplayNode &&
    codeDisplayNode.getBoundingClientRect().height +
      CONTAINER_PADDING +
      CONTAINER_PADDING_TOP;

  useEffect(() => {
    // also add a little buffer here so it doesn't just expand by a silly amount
    if (codeHeight && codeHeight < CLIPPED_MAX_HEIGHT + 50) {
      setShouldClip(false);
    }
  }, [codeHeight, selectedSnippet]);

  const onExpandCodeClick = () => {
    if (isClipped && codeHeight) {
      setMaxHeight(codeHeight);
      setIsClipped(false);
    } else {
      setMaxHeight(CLIPPED_MAX_HEIGHT);
      setIsClipped(true);
    }
  };

  // code can vary so much in length, better to calculate according to size rather than a static number
  const transitionTime = codeHeight
    ? (codeHeight - CLIPPED_MAX_HEIGHT) / 3000
    : 0;

  return (
    <div
      ref={containerRef}
      className={cx(classes.container, className)}
      style={{
        padding: CONTAINER_PADDING,
        paddingTop: CONTAINER_PADDING_TOP,
        ...(shouldClip ? { maxHeight, overflow: 'hidden' } : {}),
        transition: `max-height ${Math.max(
          0.3,
          Math.floor(10 * transitionTime) / 10,
        )}s ease`,
      }}
      onMouseOver={onHover}
      onMouseLeave={onLeave}
    >
      <div style={{ display: 'none' }}>
        {snippetList.map((snippet) => {
          return (
            <div key={snippet.snippet}>
              <h5 data-tocignore={true}>{snippet.languageDisplayName}:</h5>
              <pre>
                <code>{snippet.snippet}</code>
              </pre>
            </div>
          );
        })}
      </div>
      <div data-cord-search-ignore="true" data-search-ignore="true">
        <CodeDisplay
          language={snippetList[selectedSnippet].language}
          code={codeString}
        />
        {shouldClip && (
          <ExpandCodeButton clipped={isClipped} onClick={onExpandCodeClick} />
        )}
        {shouldClip && isClipped && (
          <div
            aria-hidden={true}
            style={{
              pointerEvents: 'none',
              position: 'absolute',
              height: '150px',
              bottom: 0,
              left: 0,
              right: 0,
              background: `linear-gradient(180deg, rgba(18, 19, 20, 0) 0%, ${Colors.BRAND_PRIMARY} 100%`,
            }}
          />
        )}
        <div className={classes.codeSwitchButtons}>
          {snippetList.map((snippet, idx) => {
            return (
              <SwitchCodeButton
                key={'snippet-' + idx}
                displayName={snippet.languageDisplayName}
                selected={idx === selectedSnippet}
                value={idx}
                onChange={onChangeSelectedSnippet}
                disabled={snippetList.length === 1}
              />
            );
          })}
        </div>
        <div
          className={cx(classes.copyButton, {
            [classes.copyButtonUsed]: hasCopied,
          })}
          style={{
            opacity: hovered || holdMessage ? '1' : '0',
          }}
          onClick={copy}
        >
          {hasCopied ? 'Copied!' : 'Copy'}
        </div>
      </div>
    </div>
  );
}

export default CodeBlock;
