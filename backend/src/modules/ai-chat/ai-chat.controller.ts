import { Response, NextFunction } from 'express';
import { aiChatService } from './ai-chat.service';
import { ApiResponse } from '../../utils/api-response.util';
import { AuthenticatedRequest } from '../../interfaces/request.interface';

class AIChatController {
  async getConversations(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const conversations = await aiChatService.getConversations(userId);
      ApiResponse.success(res, 'Chat conversations fetched successfully', { conversations });
    } catch (error) {
      next(error);
    }
  }

  async getConversationById(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const conversationId = req.params['id'] as string;
      const conversation = await aiChatService.getConversationById(userId, conversationId);
      ApiResponse.success(res, 'Chat conversation details fetched successfully', { conversation });
    } catch (error) {
      next(error);
    }
  }

  async sendMessage(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { conversationId, message } = req.body;
      const result = await aiChatService.sendMessage(req.user!, conversationId, message);
      ApiResponse.success(res, 'Reply generated successfully', result);
    } catch (error) {
      next(error);
    }
  }

  async deleteAllConversations(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      await aiChatService.deleteAllConversations(userId);
      ApiResponse.success(res, 'All conversations deleted successfully');
    } catch (error) {
      next(error);
    }
  }
}

export const aiChatController = new AIChatController();
