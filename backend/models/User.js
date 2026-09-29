import db, { pool } from '../config/db.js';
import bcrypt from 'bcryptjs';


class User{
    // create new user (handles both password and OAuth signups)
    static async create({ email, password = null, name, avatar_url = null, google_id = null, github_id = null, auth_provider = 'local' }) {
        const hashedPassword = password ? await bcrypt.hash(password, 10) : null;

        const result = await pool.query(
            `INSERT INTO users (email, name, password, avatar_url, google_id, github_id, auth_provider) 
            VALUES ($1, $2, $3, $4, $5, $6, $7) 
            RETURNING id, email, name, avatar_url, google_id, github_id, auth_provider, created_at`,
            [email.toLowerCase(), name, hashedPassword, avatar_url, google_id, github_id, auth_provider]
        );

        return result.rows[0];
    }

    // find user by email
    static async findOne({ email }) {
        const result = await pool.query(
            `SELECT id, email, name, avatar_url, password, google_id, github_id, auth_provider, created_at 
             FROM users WHERE LOWER(email) = LOWER($1)`,
            [email]
        );

        return result.rows[0];
    }

    // find user by Google ID
    static async findByGoogleId(google_id) {
        const result = await pool.query(
            `SELECT id, email, name, avatar_url, password, google_id, github_id, auth_provider, created_at 
             FROM users WHERE google_id = $1`,
            [google_id]
        );

        return result.rows[0];
    }

    // find user by GitHub ID
    static async findByGithubId(github_id) {
        const result = await pool.query(
            `SELECT id, email, name, avatar_url, password, google_id, github_id, auth_provider, created_at 
             FROM users WHERE github_id = $1`,
            [github_id]
        );

        return result.rows[0];
    }

    // find or create OAuth user with smart account linking
    static async findOrCreateOAuthUser({ email, name, avatar_url, google_id = null, github_id = null, provider }) {
        let user = null;

        // 1. Try finding by provider ID
        if (google_id) {
            user = await this.findByGoogleId(google_id);
        } else if (github_id) {
            user = await this.findByGithubId(github_id);
        }

        if (user) {
            return { user, isNewUser: false };
        }

        // 2. Try finding by email (link accounts if already registered)
        if (email) {
            user = await this.findOne({ email });
            if (user) {
                // Link provider ID and avatar if missing
                const updates = [];
                const values = [];
                let idx = 1;

                if (google_id && !user.google_id) {
                    updates.push(`google_id = $${idx++}`);
                    values.push(google_id);
                }
                if (github_id && !user.github_id) {
                    updates.push(`github_id = $${idx++}`);
                    values.push(github_id);
                }
                if (avatar_url && !user.avatar_url) {
                    updates.push(`avatar_url = $${idx++}`);
                    values.push(avatar_url);
                }

                if (updates.length > 0) {
                    values.push(user.id);
                    const updateQuery = `
                        UPDATE users 
                        SET ${updates.join(', ')} 
                        WHERE id = $${idx} 
                        RETURNING id, email, name, avatar_url, google_id, github_id, auth_provider, created_at
                    `;
                    const updateResult = await pool.query(updateQuery, values);
                    user = updateResult.rows[0];
                }

                return { user, isNewUser: false };
            }
        }

        // 3. User does not exist, create new
        const newUser = await this.create({
            email,
            name: name || (email ? email.split('@')[0] : 'Chef'),
            avatar_url: avatar_url || null,
            google_id,
            github_id,
            auth_provider: provider
        });

        return { user: newUser, isNewUser: true };
    }
    
    // find by id
    static async findById(id) {
        const result = await pool.query(
            `SELECT id, email, name, avatar_url, password, google_id, github_id, auth_provider, created_at FROM users WHERE id = $1`,
            [id]
        );
        return result.rows[0];
    }

    // update basic

    static async update(id, updates){
        const {name, email, avatar_url} = updates;
        const result = await pool.query(
            `UPDATE users 
            SET name = $1, email = $2, avatar_url = $3 
            WHERE id = $4 
            RETURNING id, name, email, avatar_url`,
            [name, email, avatar_url || null, id]
        );
        return result.rows[0];
    }

    // update password for user

    static async updatePassword(id, newPassword){
        const hashed = await bcrypt.hash(newPassword, 10);
        const result = await pool.query(
            `UPDATE users SET password = $1 WHERE id = $2`,
            [hashed, id]
        );
        return result.rowCount > 0;
    }

    // delete user account
    static async delete(id){
        await pool.query(`DELETE FROM users WHERE id = $1`, [id]);
    }

    // verify user password

    static async verifyPassword(plainPassword, hashedPassword){
        return await bcrypt.compare(plainPassword, hashedPassword);
    }
}

export default User;
