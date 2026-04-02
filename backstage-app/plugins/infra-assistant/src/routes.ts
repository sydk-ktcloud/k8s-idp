import React from 'react';
import { Route } from 'react-router-dom';
import { ChatPage } from './components/ChatPage';

export const infraAssistantRoutes = (
  <Route path="/" element={<ChatPage />} />
);