import { useEffect, useRef, useState } from 'react';
import Draggable from 'react-draggable';
import type { DraggableData, DraggableEvent } from 'react-draggable';
import Paper from '@material-ui/core/Paper';
import IconButton from '@material-ui/core/IconButton';
import TextField from '@material-ui/core/TextField';
import Button from '@material-ui/core/Button';
import Typography from '@material-ui/core/Typography';
import CircularProgress from '@material-ui/core/CircularProgress';
import ChatIcon from '@material-ui/icons/Chat';
import CloseIcon from '@material-ui/icons/Close';
import { sendMessage } from '@internal/backstage-plugin-infra-assistant';

type ChatMessage = {
  role: 'user' | 'assistant';
  text: string;
};

type Position = {
  x: number;
  y: number;
};

type PersistedChatState = {
  messages: ChatMessage[];
  savedAt: number;
};

const BUBBLE_SIZE = 60;
const PANEL_WIDTH = 380;
const PANEL_HEIGHT = 600;
const GAP = 24;
const STORAGE_KEY = 'infra-assistant-chat-history';
const STORAGE_TTL_MS = 1000 * 60 * 60 * 12;

function getInitialMessages(): ChatMessage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [
        {
          role: 'assistant',
          text: '안녕하세요. Infra Assistant입니다. 필요한 내용을 질문해주세요.',
        },
      ];
    }

    const parsed: PersistedChatState = JSON.parse(raw);
    const isExpired = Date.now() - parsed.savedAt > STORAGE_TTL_MS;

    if (isExpired || !Array.isArray(parsed.messages) || parsed.messages.length === 0) {
      localStorage.removeItem(STORAGE_KEY);
      return [
        {
          role: 'assistant',
          text: '안녕하세요. Infra Assistant입니다. 필요한 내용을 질문해주세요.',
        },
      ];
    }

    return parsed.messages;
  } catch {
    return [
      {
        role: 'assistant',
        text: '안녕하세요. Infra Assistant입니다. 필요한 내용을 질문해주세요.',
      },
    ];
  }
}

export const InfraAssistantWidget = () => {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>(getInitialMessages);
  const [position, setPosition] = useState<Position>({ x: 0, y: 0 });
  const [mounted, setMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const bubbleNodeRef = useRef<HTMLDivElement>(null);
  const panelNodeRef = useRef<HTMLDivElement>(null);
  const bubbleDraggedRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const initialX = window.innerWidth - BUBBLE_SIZE - GAP;
    const initialY = window.innerHeight - BUBBLE_SIZE - GAP;
    setPosition({ x: initialX, y: initialY });
    setMounted(true);
  }, []);

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        messages,
        savedAt: Date.now(),
      }),
    );
  }, [messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const sendMessageHandler = async () => {
    if (isLoading || !input.trim()) return;

    const userText = input.trim();

    setMessages(prev => [...prev, { role: 'user', text: userText }]);
    setInput('');
    setIsLoading(true);

    try {
      const historyForApi = messages.map(msg => ({
        role: msg.role,
        content: msg.text,
      }));

      const response = await sendMessage(historyForApi, userText);

      setMessages(prev => [
        ...prev,
        { role: 'assistant', text: response.message },
      ]);
    } catch (error) {
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          text:
            error instanceof Error
              ? error.message
              : 'Infra Assistant 호출 중 오류가 발생했습니다.',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBubbleClick = () => {
    if (bubbleDraggedRef.current) {
      bubbleDraggedRef.current = false;
      return;
    }
    setOpen(true);
  };

  const handleBubbleStart = () => {
    bubbleDraggedRef.current = false;
  };

  const handleBubbleDrag = (_e: DraggableEvent, data: DraggableData) => {
    if (Math.abs(data.deltaX) > 0 || Math.abs(data.deltaY) > 0) {
      bubbleDraggedRef.current = true;
    }
  };

  const handleBubbleStop = (_e: DraggableEvent, data: DraggableData) => {
    setPosition({ x: data.x, y: data.y });
  };

  const handlePanelStop = (_e: DraggableEvent, data: DraggableData) => {
    setPosition({ x: data.x, y: data.y });
  };

  if (!mounted) return null;

  return (
    <>
      {!open && (
        <Draggable
          nodeRef={bubbleNodeRef}
          position={position}
          bounds={{
            left: 0,
            top: 0,
            right: Math.max(0, window.innerWidth - BUBBLE_SIZE),
            bottom: Math.max(0, window.innerHeight - BUBBLE_SIZE),
          }}
          onStart={handleBubbleStart}
          onDrag={handleBubbleDrag}
          onStop={handleBubbleStop}
        >
          <div
            ref={bubbleNodeRef}
            style={{
              position: 'fixed',
              left: 0,
              top: 0,
              zIndex: 1300,
            }}
          >
            <IconButton
              onClick={handleBubbleClick}
              style={{
                width: BUBBLE_SIZE,
                height: BUBBLE_SIZE,
                borderRadius: '50%',
                backgroundColor: '#1976d2',
                color: '#fff',
                boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
              }}
            >
              <ChatIcon />
            </IconButton>
          </div>
        </Draggable>
      )}

      {open && (
        <Draggable
          nodeRef={panelNodeRef}
          position={position}
          bounds={{
            left: 0,
            top: 0,
            right: Math.max(0, window.innerWidth - PANEL_WIDTH),
            bottom: Math.max(0, window.innerHeight - PANEL_HEIGHT),
          }}
          onStop={handlePanelStop}
          cancel="input,textarea,button,svg,path"
        >
          <div
            ref={panelNodeRef}
            style={{
              position: 'fixed',
              left: 0,
              top: 0,
              zIndex: 1300,
            }}
          >
            <Paper
              elevation={6}
              style={{
                width: PANEL_WIDTH,
                height: PANEL_HEIGHT,
                display: 'flex',
                flexDirection: 'column',
                borderRadius: 16,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: 56,
                  backgroundColor: '#1976d2',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0 16px',
                  flexShrink: 0,
                }}
              >
                <Typography variant="subtitle1" style={{ fontWeight: 600 }}>
                  Infra Assistant
                </Typography>
                <IconButton
                  onClick={() => setOpen(false)}
                  style={{ color: '#fff' }}
                >
                  <CloseIcon />
                </IconButton>
              </div>

              <div
                style={{
                  flex: 1,
                  padding: 16,
                  overflowY: 'auto',
                  backgroundColor: '#f7f9fb',
                }}
              >
                {messages.map((msg, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      justifyContent:
                        msg.role === 'user' ? 'flex-end' : 'flex-start',
                      marginBottom: 12,
                    }}
                  >
                    <div
                      style={{
                        maxWidth: '75%',
                        padding: '10px 14px',
                        borderRadius: 16,
                        backgroundColor:
                          msg.role === 'user' ? '#1976d2' : '#e9eef5',
                        color: msg.role === 'user' ? '#fff' : '#111',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                      }}
                    >
                      {msg.text}
                    </div>
                  </div>
                ))}

                {isLoading && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      marginTop: 8,
                    }}
                  >
                    <CircularProgress size={18} />
                    <Typography variant="body2" color="textSecondary">
                      답변 생성 중...
                    </Typography>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              <div
                style={{
                  padding: 12,
                  borderTop: '1px solid #e0e0e0',
                  display: 'flex',
                  gap: 8,
                  backgroundColor: '#fff',
                  flexShrink: 0,
                }}
              >
                <TextField
                  fullWidth
                  size="small"
                  variant="outlined"
                  placeholder="질문을 입력하세요..."
                  value={input}
                  disabled={isLoading}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendMessageHandler();
                    }
                  }}
                />
                <Button
                  variant="contained"
                  color="primary"
                  onClick={sendMessageHandler}
                  disabled={isLoading || !input.trim()}
                >
                  {isLoading ? '전송 중' : '전송'}
                </Button>
              </div>
            </Paper>
          </div>
        </Draggable>
      )}
    </>
  );
};