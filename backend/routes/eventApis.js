import express from 'express';
import {
    createEventController,
    deleteEventController,
    getEventRegistrantsController,
    listEventsController,
    toggleAvailabilityController,
    updateEventController,
} from '../controllers/eventControllers.js';
import { registerForEventController } from '../controllers/registrationControllers.js';
import { requireAdmin, requireAuth } from '../middleware/auth.js';

const router = express.Router();

// ── Public-ish (requires login) ──────────────────────────────
// GET all events (users see available=true only; admins see all)
router.get('/', requireAuth, listEventsController);

// User registers for an event
router.post('/:id/register', requireAuth, registerForEventController);

// ── Admin-only ───────────────────────────────────────────────
// Create a new event
router.post('/', requireAuth, requireAdmin, createEventController);

// Update event fields
router.patch('/:id', requireAuth, requireAdmin, updateEventController);

// Toggle available flag
router.patch('/:id/availability', requireAuth, requireAdmin, toggleAvailabilityController);

// Delete event (also deletes registrations)
router.delete('/:id', requireAuth, requireAdmin, deleteEventController);

// View all registrants for an event
router.get('/:id/registrations', requireAuth, requireAdmin, getEventRegistrantsController);

export default router;
