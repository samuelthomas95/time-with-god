const {index, integer, sqliteTable, text} = require('drizzle-orm/sqlite-core');
exports.feedback = sqliteTable('feedback', {
  id: text().primaryKey().notNull(),
  message: text().notNull(),
  createdAt: integer('created_at').notNull()
}, table => [index('feedback_created_at').on(table.createdAt)]);
