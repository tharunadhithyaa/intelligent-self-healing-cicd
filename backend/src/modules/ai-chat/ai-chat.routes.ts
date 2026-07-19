import { Router } from 'express';
import { aiChatController } from './ai-chat.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validation.middleware';
import { sendMessageSchema } from './ai-chat.validation';

const router = Router();

// Protect all AI assistant routes with JWT verification
router.use(authenticate);

router.get('/conversations', aiChatController.getConversations.bind(aiChatController));
router.delete('/conversations', aiChatController.deleteAllConversations.bind(aiChatController));
router.get('/conversations/:id', aiChatController.getConversationById.bind(aiChatController));
router.post('/message', validate(sendMessageSchema), aiChatController.sendMessage.bind(aiChatController));

export default router;
