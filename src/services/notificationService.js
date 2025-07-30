// File: src/services/notificationService.js

class NotificationService {
    constructor() {
        this.isEnabled = process.env.NODE_ENV !== 'development';
    }

    // Send real-time notification using socket server
    async sendRealTimeNotification(userId, notification) {
        try {
            if (global.socketServer) {
                console.log(`Sending real-time notification to user ${userId}:`, notification);
                const result = await global.socketServer.sendNotificationToUser(userId, notification);
                console.log(`✅ Notification sent successfully to user ${userId}`);
                return result;
            } else {
                console.warn('Socket server not available, saving notification to database only');
                return await this.saveNotificationToDatabase(userId, notification);
            }
        } catch (error) {
            console.error('Error sending real-time notification:', error);
            // Fallback to database only
            try {
                return await this.saveNotificationToDatabase(userId, notification);
            } catch (dbError) {
                console.error('Failed to save notification to database:', dbError);
                throw error;
            }
        }
    }

    // Send notification to multiple users
    async sendNotificationToUsers(userIds, notification) {
        try {
            if (global.socketServer) {
                return await global.socketServer.sendNotificationToUsers(userIds, notification);
            } else {
                console.warn('Socket server not available, saving notifications to database only');
                const promises = userIds.map(userId => this.saveNotificationToDatabase(userId, notification));
                return Promise.all(promises);
            }
        } catch (error) {
            console.error('Error sending notifications to users:', error);
            throw error;
        }
    }

    // Send notification to role
    async sendNotificationToRole(role, notification) {
        try {
            if (global.socketServer) {
                return await global.socketServer.sendNotificationToRole(role, notification);
            } else {
                console.warn('Socket server not available, saving notifications to database only');
                return await this.saveNotificationToRole(role, notification);
            }
        } catch (error) {
            console.error('Error sending notification to role:', error);
            throw error;
        }
    }

    // Save notification to database only
    async saveNotificationToDatabase(userId, notification) {
        const Notification = require('../models/Notification');
        return await Notification.create({
            userId,
            title: notification.title,
            message: notification.message,
            type: notification.type || 'info',
            priority: notification.priority || 'medium',
            category: notification.category || 'general',
            metadata: notification.metadata || {}
        });
    }

    // Save notification to database for role
    async saveNotificationToRole(role, notification) {
        const User = require('../models/User');
        const users = await User.find({ role }).select('_id');
        const userIds = users.map(user => user._id.toString());
        
        const promises = userIds.map(userId => this.saveNotificationToDatabase(userId, notification));
        return Promise.all(promises);
    }

    // Task-related notifications
    async sendTaskAssignedNotification(technicianId, task, assignedBy) {
        return await this.sendRealTimeNotification(technicianId, {
            title: 'New Task Assigned',
            message: `You have been assigned a new task: ${task.title}`,
            type: 'info',
            priority: task.priority || 'medium',
            category: 'task',
            metadata: {
                taskId: task._id,
                projectId: task.project,
                assignedBy: assignedBy._id
            }
        });
    }

    async sendTaskCompletedNotification(managerId, task, completedBy) {
        return await this.sendRealTimeNotification(managerId, {
            title: 'Task Completed',
            message: `Task "${task.title}" has been completed by ${completedBy.name}`,
            type: 'success',
            priority: 'medium',
            category: 'task',
            metadata: {
                taskId: task._id,
                projectId: task.project,
                completedBy: completedBy._id
            }
        });
    }

    // Project-related notifications
    async sendProjectCreatedNotification(project, createdBy) {
        return await this.sendNotificationToRole('super-admin', {
            title: 'New Project Created',
            message: `A new project "${project.title}" has been created by ${createdBy.name}`,
            type: 'info',
            priority: 'medium',
            category: 'project',
            metadata: {
                projectId: project._id,
                createdBy: createdBy._id
            }
        });
    }

    async sendProjectStatusChangedNotification(project, newStatus, changedBy) {
        return await this.sendNotificationToRole('super-admin', {
            title: 'Project Status Updated',
            message: `Project "${project.title}" status changed to ${newStatus} by ${changedBy.name}`,
            type: 'info',
            priority: 'medium',
            category: 'project',
            metadata: {
                projectId: project._id,
                newStatus,
                changedBy: changedBy._id
            }
        });
    }

    // Report-related notifications
    async sendReportSubmittedNotification(managerId, report, submittedBy) {
        return await this.sendRealTimeNotification(managerId, {
            title: 'Report Submitted',
            message: `A new report has been submitted by ${submittedBy.name}`,
            type: 'success',
            priority: 'medium',
            category: 'report',
            metadata: {
                reportId: report._id,
                submittedBy: submittedBy._id
            }
        });
    }

    // System notifications
    async sendSystemMaintenanceNotification(message) {
        if (global.socketServer) {
            global.socketServer.emitSystemMaintenance(message);
        }
        console.log(`[SYSTEM MAINTENANCE] ${message}`);
    }

    async sendSystemAlertNotification(message) {
        if (global.socketServer) {
            global.socketServer.emitSystemAlert(message);
        }
        console.log(`[SYSTEM ALERT] ${message}`);
    }

    // Email notifications (for future use)
    async sendWelcomeEmail(email, name) {
        if (!this.isEnabled) {
            console.log(`[NOTIFICATION] Welcome email would be sent to: ${email} (Name: ${name})`);
            return { success: true, method: 'console' };
        }
        
        // Add actual email logic here when needed
        return { success: true, method: 'email' };
    }

    async sendPasswordResetEmail(email, resetToken) {
        if (!this.isEnabled) {
            console.log(`[NOTIFICATION] Password reset email would be sent to: ${email} (Token: ${resetToken})`);
            return { success: true, method: 'console' };
        }
        
        // Add actual email logic here when needed
        return { success: true, method: 'email' };
    }

    async sendNotification(email, subject, message) {
        if (!this.isEnabled) {
            console.log(`[NOTIFICATION] Email notification:`);
            console.log(`  To: ${email}`);
            console.log(`  Subject: ${subject}`);
            console.log(`  Message: ${message}`);
            return { success: true, method: 'console' };
        }
        
        // Add actual email logic here when needed
        return { success: true, method: 'email' };
    }

    async sendUserUpdateNotification(userId, updateType, data) {
        if (!this.isEnabled) {
            console.log(`[NOTIFICATION] User update notification:`);
            console.log(`  User ID: ${userId}`);
            console.log(`  Update Type: ${updateType}`);
            console.log(`  Data:`, data);
            return { success: true, method: 'console' };
        }
        
        // Add actual notification logic here when needed
        return { success: true, method: 'notification' };
    }

    // Method to send account verification email
    async sendVerificationEmail(email, verificationToken) {
        if (!this.isEnabled) {
            console.log(`[NOTIFICATION] Verification email would be sent to: ${email} (Token: ${verificationToken})`);
            return { success: true, method: 'console' };
        }
        
        // Add actual email logic here when needed
        return { success: true, method: 'email' };
    }

    // Method to send account deletion confirmation
    async sendAccountDeletionConfirmation(email, userName) {
        if (!this.isEnabled) {
            console.log(`[NOTIFICATION] Account deletion confirmation would be sent to: ${email} (User: ${userName})`);
            return { success: true, method: 'console' };
        }
        
        // Add actual email logic here when needed
        return { success: true, method: 'email' };
    }
}

module.exports = new NotificationService();