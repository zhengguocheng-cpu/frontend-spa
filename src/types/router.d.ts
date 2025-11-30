import 'react-router-dom';

declare module 'react-router-dom' {
  interface RouteChildrenProps {
    children?: React.ReactNode;
  }
}