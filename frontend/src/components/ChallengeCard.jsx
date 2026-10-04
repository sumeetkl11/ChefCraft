import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import '../styles/ChallengeCard.css';

export default function ChallengeCard({ challenge, onJoin }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleJoin = async () => {
    try {
      setLoading(true);
      const response = await api.post(`/challenges/${challenge.id}/join`, {});

      if (response.data?.success || response.status === 200 || response.status === 201) {
        onJoin?.(challenge.id);
      }
    } catch (error) {
      console.error('Error joining challenge:', error);
    } finally {
      setLoading(false);
    }
  };

  const daysRemaining = Math.ceil(
    (new Date(challenge.end_date) - new Date()) / (1000 * 60 * 60 * 24)
  );

  return (
    <div className="challenge-card">
      {challenge.image_url && (
        <img src={challenge.image_url} alt={challenge.title} className="challenge-image" loading="lazy" decoding="async" />
      )}
      <div className="challenge-content">
        <h3>{challenge.title}</h3>
        <p className="challenge-description">{challenge.description}</p>
        <div className="challenge-meta">
          <span className="participants">{challenge.participant_count} participants</span>
          <span className={`days-remaining ${daysRemaining <= 3 ? 'urgent' : ''}`}>
            {daysRemaining} days left
          </span>
        </div>
        <button
          onClick={handleJoin}
          disabled={loading}
          className="join-btn"
        >
          {loading ? 'Joining...' : 'Join Challenge'}
        </button>
      </div>
    </div>
  );
}
