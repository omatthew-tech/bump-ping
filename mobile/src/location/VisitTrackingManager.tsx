import { ReactNode, useEffect } from 'react';
import { useVisitTracking } from './useVisitTracking';

type Props = {
  children: ReactNode;
};

const VisitTrackingManager = ({ children }: Props) => {
  const status = useVisitTracking();

  useEffect(() => {
    if (status === 'denied') {
      console.info('Visit tracking requires background location permissions.');
    }
  }, [status]);

  return <>{children}</>;
};

export default VisitTrackingManager;

