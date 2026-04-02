import React, { useState } from 'react';
import { sendMessage } from '../api';

type Message = {
  role: 'user' | 'assistant';
  content: string;
};

export const InfraAssistantPage = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: '안녕하세요. Infra Assistant입니다. 필요한 내용을 질문해주세요.',
    },
  ]);

  const [input, setInput] = useState('');

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage = input;

    setMessages(prev => [
      ...prev,
      { role: 'user', content: userMessage },
    ]);

    setInput('');

    try {
      const response = await sendMessage(messages, userMessage);

      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: response.message },
      ]);
    } catch (error) {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: '응답 중 오류가 발생했습니다.' },
      ]);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      bottom: 20,
      right: 20,
      width: 350,
      height: 500,
      background: 'white',
      borderRadius: 8,
      boxShadow: '0 0 10px rgba(0,0,0,0.2)',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <div style={{
        padding: 10,
        background: '#1976d2',
        color: 'white',
        fontWeight: 'bold'
      }}>
        Infra Assistant
      </div>

      <div style={{
        flex: 1,
        padding: 10,
        overflowY: 'auto'
      }}>
        {messages.map((msg, i) => (
          <div key={i} style={{
            textAlign: msg.role === 'user' ? 'right' : 'left',
            marginBottom: 8
          }}>
            <span style={{
              background: msg.role === 'user' ? '#1976d2' : '#eee',
              color: msg.role === 'user' ? 'white' : 'black',
              padding: 8,
              borderRadius: 8,
              display: 'inline-block',
              maxWidth: '80%'
            }}>
              {msg.content}
            </span>
          </div>
        ))}
      </div>

      <div style={{
        display: 'flex',
        padding: 10,
        borderTop: '1px solid #ddd'
      }}>
        <input
          style={{ flex: 1, padding: 8 }}
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="질문을 입력하세요..."
        />
        <button onClick={handleSend}>
          전송
        </button>
      </div>
    </div>
  );
};