import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function Landing() {
  const [, setLocation] = useLocation();
  const [showSecondBubble, setShowSecondBubble] = useState(false);
  const [showThirdBubble, setShowThirdBubble] = useState(false);

  useEffect(() => {
    const timer1 = setTimeout(() => setShowSecondBubble(true), 1000);
    const timer2 = setTimeout(() => setShowThirdBubble(true), 2000);
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="container mx-auto px-4 py-12">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">VoiceAI Chat</h1>
          <ThemeToggle />
        </div>

        {/* Hero Section */}
        <div className="text-center mb-16">
          <h2 className="text-5xl font-bold mb-6 bg-gradient-to-r from-primary/90 to-primary bg-clip-text text-transparent animate-gradient">
            Experience AI Conversations
            <br />
            Like Never Before
          </h2>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Engage in natural conversations with AI using your voice. 
            Experience seamless text-to-speech and speech-to-text capabilities.
          </p>
          <Button 
            size="lg" 
            onClick={() => setLocation("/chat")}
            className="bg-primary/90 hover:bg-primary hover:scale-105 transition-all duration-300 shadow-[0_0_15px_rgba(0,0,0,0.1)] hover:shadow-[0_0_20px_rgba(var(--primary),0.3)] rounded-full px-8 py-6 text-lg"
          >
            Get Started
          </Button>
        </div>

        {/* Demo Chat Bubbles */}
        <div className="max-w-2xl mx-auto mb-16 relative min-h-[200px]">
          <div className="message-bubble message-bubble-user opacity-0 animate-fadeIn">
            How can you help me today?
          </div>

          {showSecondBubble && (
            <div className="message-bubble message-bubble-ai mt-4 opacity-0 animate-fadeIn">
              I can assist with voice chat, text conversations, and provide helpful responses!
            </div>
          )}

          {showThirdBubble && (
            <div className="message-bubble message-bubble-user mt-4 opacity-0 animate-fadeIn">
              That sounds great! Let's get started.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}