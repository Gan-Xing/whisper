// app/types/index.ts

export interface Transcript {
    type?: string;
    text?: string;
    message?: string;
    id?: string;
    audio?: string;
    status?: string;
  }
  
  export interface RealTimeTranscriptionProps {
    dictionary: any;
  }

  export interface Dimensions {
    width: number;
    height: number;
  }
  