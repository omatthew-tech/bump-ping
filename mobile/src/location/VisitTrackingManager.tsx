import { ReactNode, useEffect } from 'react';
import { useVisitTracking } from './useVisitTracking';

type Props = {
  children: ReactNode;
  enabled?: boolean;
};

const VisitTrackingManager = ({ children, enabled = true }: Props) => {
  const status = useVisitTracking(enabled);

  useEffect(() => {
    if (status === 'denied') {
      console.info('Visit tracking requires background location permissions.');
    }
  }, [status]);

  return <>{children}</>;
};

export default VisitTrackingManager;

