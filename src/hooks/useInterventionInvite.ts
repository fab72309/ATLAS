import React from 'react';
import { createInvite } from '../services/invitesService';

const buildJoinUrl = (token: string) => (
  `${window.location.origin}${window.location.pathname}#/join?token=${encodeURIComponent(token)}`
);

export const useInterventionInvite = () => {
  const generateShareLink = React.useCallback(async (interventionId: string) => {
    const { token } = await createInvite(interventionId);
    return buildJoinUrl(token);
  }, []);

  return {
    generateShareLink
  };
};
