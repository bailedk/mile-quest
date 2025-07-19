/**
 * Default notification templates for Mile Quest
 * These templates define the standard notifications used throughout the system
 */

import { CreateTemplateInput, NotificationCategory, NotificationPriority } from './types';

export const defaultNotificationTemplates: CreateTemplateInput[] = [
  // Activity Templates
  {
    key: 'activity_created',
    name: 'Activity Created',
    description: 'Notification sent when a user logs a new activity',
    category: 'ACTIVITY' as NotificationCategory,
    priority: 'LOW' as NotificationPriority,
    subject: 'Activity Logged',
    content: 'You logged {{distance}}km of activity{{#teamName}} for team {{teamName}}{{/teamName}}',
    emailContent: `
      <h2>Great job logging your activity!</h2>
      <p>You've logged <strong>{{distance}}km</strong> of activity.</p>
      {{#teamName}}<p>This activity has been added to your team <strong>{{teamName}}</strong>.</p>{{/teamName}}
      <p>Keep up the great work!</p>
    `,
    variables: ['distance', 'teamName'],
  },
  {
    key: 'activity_milestone_distance',
    name: 'Distance Milestone',
    description: 'Notification for reaching distance milestones',
    category: 'ACTIVITY' as NotificationCategory,
    priority: 'HIGH' as NotificationPriority,
    subject: 'Distance Milestone Reached! 🎉',
    content: 'Amazing! You\'ve reached {{milestone}}km total distance!',
    emailContent: `
      <h2>🎉 Congratulations on your milestone!</h2>
      <p>You've reached an incredible <strong>{{milestone}}km</strong> total distance!</p>
      <p>This is a fantastic achievement. Keep up the momentum!</p>
      <hr>
      <p>View your progress and stats in the Mile Quest app.</p>
    `,
    variables: ['milestone'],
  },
  {
    key: 'activity_milestone_streak',
    name: 'Streak Milestone',
    description: 'Notification for reaching activity streaks',
    category: 'ACTIVITY' as NotificationCategory,
    priority: 'HIGH' as NotificationPriority,
    subject: 'Streak Milestone! 🔥',
    content: 'Incredible! You\'re on a {{streak}} day streak!',
    emailContent: `
      <h2>🔥 You're on fire!</h2>
      <p>You've maintained an amazing <strong>{{streak}} day streak</strong>!</p>
      <p>Consistency is key to achieving your goals. Keep the momentum going!</p>
      <hr>
      <p>Don't break the streak - log another activity today!</p>
    `,
    variables: ['streak'],
  },

  // Team Templates
  {
    key: 'team_member_joined',
    name: 'Team Member Joined',
    description: 'Notification when someone joins a team',
    category: 'TEAM' as NotificationCategory,
    priority: 'MEDIUM' as NotificationPriority,
    subject: 'New Team Member',
    content: '{{memberName}} joined {{teamName}}! Welcome to the team! 👋',
    emailContent: `
      <h2>Welcome a new team member! 👋</h2>
      <p><strong>{{memberName}}</strong> has joined <strong>{{teamName}}</strong>!</p>
      <p>Say hello and help them get started on their Mile Quest journey.</p>
      <hr>
      <p>View your team progress in the Mile Quest app.</p>
    `,
    variables: ['memberName', 'teamName'],
  },
  {
    key: 'team_goal_created',
    name: 'Team Goal Created',
    description: 'Notification when a new team goal is created',
    category: 'TEAM' as NotificationCategory,
    priority: 'HIGH' as NotificationPriority,
    subject: 'New Team Goal Created! 🎯',
    content: 'A new goal "{{goalName}}" has been created for {{teamName}}. Target: {{targetDistance}}km',
    emailContent: `
      <h2>🎯 New Team Goal!</h2>
      <p>Your team <strong>{{teamName}}</strong> has a new goal:</p>
      <h3>{{goalName}}</h3>
      <p><strong>Target Distance:</strong> {{targetDistance}}km</p>
      {{#description}}<p><strong>Description:</strong> {{description}}</p>{{/description}}
      <p>Ready to start logging activities towards this goal?</p>
      <hr>
      <p>View the full goal details and route in the Mile Quest app.</p>
    `,
    variables: ['goalName', 'teamName', 'targetDistance', 'description'],
  },
  {
    key: 'team_goal_completed',
    name: 'Team Goal Completed',
    description: 'Notification when a team completes their goal',
    category: 'TEAM' as NotificationCategory,
    priority: 'URGENT' as NotificationPriority,
    subject: 'Goal Completed! 🎉🏆',
    content: '{{teamName}} has completed the goal "{{goalName}}"! Congratulations team!',
    emailContent: `
      <h2>🎉🏆 GOAL COMPLETED!</h2>
      <p>Congratulations! Your team <strong>{{teamName}}</strong> has successfully completed:</p>
      <h3>{{goalName}}</h3>
      <p>This is an incredible achievement that represents the collective effort of every team member.</p>
      <p><strong>Total Distance:</strong> {{totalDistance}}km</p>
      <p><strong>Total Activities:</strong> {{totalActivities}}</p>
      <p><strong>Team Members:</strong> {{activeMembers}}</p>
      <hr>
      <p>Celebrate with your team and start planning your next adventure!</p>
    `,
    variables: ['teamName', 'goalName', 'totalDistance', 'totalActivities', 'activeMembers'],
  },
  {
    key: 'team_goal_milestone',
    name: 'Team Goal Milestone',
    description: 'Notification for team goal progress milestones',
    category: 'TEAM' as NotificationCategory,
    priority: 'MEDIUM' as NotificationPriority,
    subject: 'Team Progress Milestone! 📈',
    content: '{{teamName}} has reached {{percentage}}% of the goal "{{goalName}}"!',
    emailContent: `
      <h2>📈 Great team progress!</h2>
      <p>Your team <strong>{{teamName}}</strong> has reached <strong>{{percentage}}%</strong> of your goal:</p>
      <h3>{{goalName}}</h3>
      <p><strong>Progress:</strong> {{currentDistance}}km / {{targetDistance}}km</p>
      <p>You're making excellent progress as a team. Keep it up!</p>
      <hr>
      <p>View detailed progress and contribute more activities in the Mile Quest app.</p>
    `,
    variables: ['teamName', 'goalName', 'percentage', 'currentDistance', 'targetDistance'],
  },

  // Achievement Templates
  {
    key: 'achievement_earned',
    name: 'Achievement Earned',
    description: 'Notification when a user earns an achievement',
    category: 'ACHIEVEMENT' as NotificationCategory,
    priority: 'HIGH' as NotificationPriority,
    subject: 'Achievement Unlocked! 🏆',
    content: 'You earned the "{{achievementName}}" achievement! {{points}} points awarded.',
    emailContent: `
      <h2>🏆 Achievement Unlocked!</h2>
      <p>Congratulations! You've earned the <strong>{{achievementName}}</strong> achievement!</p>
      {{#description}}<p>{{description}}</p>{{/description}}
      <p><strong>Points Awarded:</strong> {{points}}</p>
      <hr>
      <p>View all your achievements in the Mile Quest app and see what you can unlock next!</p>
    `,
    variables: ['achievementName', 'points', 'description'],
  },
  {
    key: 'achievement_streak',
    name: 'Streak Achievement',
    description: 'Notification for streak-based achievements',
    category: 'ACHIEVEMENT' as NotificationCategory,
    priority: 'HIGH' as NotificationPriority,
    subject: 'Streak Achievement! 🔥',
    content: 'Amazing consistency! You\'ve earned the {{achievementName}} achievement with a {{streak}} day streak!',
    emailContent: `
      <h2>🔥 Streak Achievement!</h2>
      <p>Your consistency has paid off! You've earned the <strong>{{achievementName}}</strong> achievement!</p>
      <p><strong>Streak:</strong> {{streak}} consecutive days</p>
      <p><strong>Points Awarded:</strong> {{points}}</p>
      <p>Consistency is the key to success. Keep the momentum going!</p>
      <hr>
      <p>Can you extend your streak even further? Log today's activity in the Mile Quest app!</p>
    `,
    variables: ['achievementName', 'streak', 'points'],
  },

  // System Templates
  {
    key: 'system_announcement',
    name: 'System Announcement',
    description: 'General system announcements',
    category: 'SYSTEM' as NotificationCategory,
    priority: 'MEDIUM' as NotificationPriority,
    subject: 'Mile Quest Update',
    content: '{{title}}: {{message}}',
    emailContent: `
      <h2>{{title}}</h2>
      <p>{{message}}</p>
      {{#actionRequired}}
      <p><strong>Action Required:</strong> {{actionRequired}}</p>
      {{/actionRequired}}
      {{#actionUrl}}
      <p><a href="{{actionUrl}}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Take Action</a></p>
      {{/actionUrl}}
      <hr>
      <p>Thank you for being part of the Mile Quest community!</p>
    `,
    variables: ['title', 'message', 'actionRequired', 'actionUrl'],
  },
  {
    key: 'system_maintenance',
    name: 'System Maintenance',
    description: 'Scheduled maintenance notifications',
    category: 'SYSTEM' as NotificationCategory,
    priority: 'URGENT' as NotificationPriority,
    subject: 'Scheduled Maintenance - {{maintenanceDate}}',
    content: 'Mile Quest will undergo maintenance from {{startTime}} to {{endTime}}. Some features may be temporarily unavailable.',
    emailContent: `
      <h2>⚠️ Scheduled Maintenance</h2>
      <p>Mile Quest will undergo scheduled maintenance:</p>
      <p><strong>Date:</strong> {{maintenanceDate}}</p>
      <p><strong>Time:</strong> {{startTime}} - {{endTime}}</p>
      <p><strong>Expected Duration:</strong> {{duration}}</p>
      
      <h3>What to expect:</h3>
      <ul>
        <li>The app may be temporarily unavailable</li>
        <li>Real-time updates may be delayed</li>
        <li>Activity logging will resume after maintenance</li>
      </ul>
      
      <p>We apologize for any inconvenience and appreciate your patience as we improve Mile Quest.</p>
      <hr>
      <p>Follow our status page for real-time updates during maintenance.</p>
    `,
    variables: ['maintenanceDate', 'startTime', 'endTime', 'duration'],
  },

  // Social Templates
  {
    key: 'invite_received',
    name: 'Team Invite Received',
    description: 'Notification when user receives a team invitation',
    category: 'SOCIAL' as NotificationCategory,
    priority: 'MEDIUM' as NotificationPriority,
    subject: 'Team Invitation from {{teamName}}',
    content: '{{inviterName}} invited you to join {{teamName}}!',
    emailContent: `
      <h2>You're Invited! 🎉</h2>
      <p><strong>{{inviterName}}</strong> has invited you to join the team <strong>{{teamName}}</strong>!</p>
      {{#teamDescription}}<p>{{teamDescription}}</p>{{/teamDescription}}
      <p>Join the team to start working together towards shared goals and track your collective progress.</p>
      <hr>
      <p><a href="{{acceptUrl}}" style="background-color: #28a745; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-right: 10px;">Accept Invitation</a></p>
      <p>Or open the Mile Quest app to respond to this invitation.</p>
    `,
    variables: ['inviterName', 'teamName', 'teamDescription', 'acceptUrl'],
  },
  {
    key: 'invite_accepted',
    name: 'Team Invite Accepted',
    description: 'Notification when someone accepts a team invitation',
    category: 'SOCIAL' as NotificationCategory,
    priority: 'MEDIUM' as NotificationPriority,
    subject: '{{memberName}} Joined Your Team!',
    content: '{{memberName}} accepted your invitation and joined {{teamName}}!',
    emailContent: `
      <h2>Great news! 🎉</h2>
      <p><strong>{{memberName}}</strong> accepted your invitation and joined <strong>{{teamName}}</strong>!</p>
      <p>Your team is growing stronger. Welcome the new member and help them get started on their Mile Quest journey.</p>
      <hr>
      <p>View your team in the Mile Quest app and start working towards your goals together!</p>
    `,
    variables: ['memberName', 'teamName'],
  },

  // Reminder Templates
  {
    key: 'reminder_activity',
    name: 'Activity Reminder',
    description: 'Reminder to log daily activity',
    category: 'REMINDER' as NotificationCategory,
    priority: 'LOW' as NotificationPriority,
    subject: 'Don\'t forget to log today\'s activity! 📱',
    content: 'You haven\'t logged any activity today. Keep your streak alive!',
    emailContent: `
      <h2>📱 Activity Reminder</h2>
      <p>Hi {{userName}},</p>
      <p>We noticed you haven't logged any activity today yet.</p>
      {{#currentStreak}}
      <p>You currently have a <strong>{{currentStreak}} day streak</strong> - don't let it break!</p>
      {{/currentStreak}}
      <p>Even a short walk counts. Every bit of movement brings you closer to your goals.</p>
      <hr>
      <p>Open the Mile Quest app to quickly log today's activity.</p>
    `,
    variables: ['userName', 'currentStreak'],
  },
  {
    key: 'reminder_goal_deadline',
    name: 'Goal Deadline Reminder',
    description: 'Reminder about approaching goal deadlines',
    category: 'REMINDER' as NotificationCategory,
    priority: 'HIGH' as NotificationPriority,
    subject: 'Goal Deadline Approaching - {{goalName}}',
    content: 'Your team goal "{{goalName}}" ends in {{daysRemaining}} days. {{currentProgress}}% complete.',
    emailContent: `
      <h2>⏰ Goal Deadline Approaching</h2>
      <p>Your team <strong>{{teamName}}</strong> goal is approaching its deadline:</p>
      <h3>{{goalName}}</h3>
      <p><strong>Days Remaining:</strong> {{daysRemaining}}</p>
      <p><strong>Current Progress:</strong> {{currentProgress}}% ({{currentDistance}}km / {{targetDistance}}km)</p>
      <p><strong>Remaining Distance:</strong> {{remainingDistance}}km</p>
      
      {{#onTrack}}
      <p>✅ You're on track to complete this goal! Keep up the great work.</p>
      {{/onTrack}}
      {{^onTrack}}
      <p>⚠️ You'll need to pick up the pace to reach your goal. Every activity counts!</p>
      {{/onTrack}}
      
      <hr>
      <p>Rally your team and push towards the finish line!</p>
    `,
    variables: ['goalName', 'teamName', 'daysRemaining', 'currentProgress', 'currentDistance', 'targetDistance', 'remainingDistance', 'onTrack'],
  },
];

export function getDefaultTemplate(key: string): CreateTemplateInput | undefined {
  return defaultNotificationTemplates.find(template => template.key === key);
}

export function getTemplatesByCategory(category: NotificationCategory): CreateTemplateInput[] {
  return defaultNotificationTemplates.filter(template => template.category === category);
}

export async function seedNotificationTemplates(
  createTemplate: (input: CreateTemplateInput) => Promise<any>
): Promise<void> {
  for (const template of defaultNotificationTemplates) {
    try {
      await createTemplate(template);
      console.log(`Created notification template: ${template.key}`);
    } catch (error) {
      // Template might already exist
      console.log(`Template ${template.key} already exists or failed to create:`, error instanceof Error ? error.message : 'Unknown error');
    }
  }
}