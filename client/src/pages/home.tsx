import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Mic, MicOff, Send, Trash2, MessageSquare, Square } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { speechHandler } from "@/lib/speech";
import type { Message } from "@shared/schema";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function Home() {
  const [input, setInput] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isConversationMode, setIsConversationMode] = useState(false);
  const { toast } = useToast();

  const { data: messages = [], isLoading } = useQuery<Message[]>({
    queryKey: ["/api/messages"],
    onSuccess: (data) => {
      // If there are no messages, initialize the conversation
      if (data.length === 0) {
        initializeConversation.mutate();
      }
    }
  });

  const sendMessage = useMutation({
    mutationFn: async (content: string) => {
      if (content.length > 500) {
        toast({
          variant: "destructive",
          title: "Message too long",
          description: "Please shorten your message to under 500 characters.",
        });
        return;
      }
      const res = await apiRequest("POST", "/api/messages", {
        role: "user",
        content,
      });
      return res.json();
    },
    onSuccess: (data) => {
      const messageTimestamp = Date.now();
      console.log(`[Timing] Message received from server at: ${messageTimestamp}`);
      queryClient.invalidateQueries({ queryKey: ["/api/messages"] });
      setInput("");

      // Speak the AI's response
      if (data?.length > 1) {
        const aiResponse = data[1].content;
        console.log(`[Timing] Starting TTS request at: ${Date.now()}, ${Date.now() - messageTimestamp}ms after message`);
        speechHandler.speak(aiResponse, "ThT5KcBeYPX3keUQqHPh")
          .then(() => console.log(`[Timing] TTS response received at: ${Date.now()}`))
          .catch((error) => {
            console.error('Speech synthesis error:', error);
            toast({
              variant: "destructive",
              title: "Speech Error",
              description: error.message,
            });
          });
      }
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    },
  });

  // Add initialization mutation
  const initializeConversation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("GET", "/api/init-conversation");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/messages"] });
      // Play Rebecca's initial message
      if (data?.[0]?.content) {
        speechHandler.speak(data[0].content, "ThT5KcBeYPX3keUQqHPh")
          .catch((error) => {
            console.error('Speech synthesis error:', error);
            toast({
              variant: "destructive",
              title: "Speech Error",
              description: error.message,
            });
          });
      }
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to start conversation",
      });
    },
  });

  const clearChat = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", "/api/messages");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/messages"] });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    sendMessage.mutate(input);
  };

  const toggleConversationMode = () => {
    const newMode = !isConversationMode;
    setIsConversationMode(newMode);
    speechHandler.setConversationMode(newMode);

    if (newMode) {
      toast({
        title: "Conversation Mode Enabled",
        description: "AI will listen continuously and respond with voice.",
      });
      setIsListening(true);
    } else {
      toast({
        title: "Conversation Mode Disabled",
        description: "Returning to manual input mode.",
      });
      setIsListening(false);
    }
  };

  const toggleListening = () => {
    if (isListening) {
      speechHandler.stopListening();
      setIsListening(false);
    } else {
      speechHandler.startListening(
        (text) => {
          setInput(text);
          sendMessage.mutate(text);
        },
        (error) => {
          setIsListening(false);
          toast({
            variant: "destructive",
            title: "Speech Recognition Error",
            description: error,
          });
        }
      );
      setIsListening(true);
    }
  };

  const stopSpeaking = () => {
    speechHandler.stopSpeaking().catch((error) => {
      console.error('Error stopping speech:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to stop speech playback"
      });
    });
  };

  // Update the chat container to auto-scroll
  useEffect(() => {
    if (messages.length > 0) {
      const scrollArea = document.querySelector('.scroll-area-viewport');
      if (scrollArea) {
        scrollArea.scrollTop = scrollArea.scrollHeight;
      }
    }
  }, [messages, sendMessage.isPending]);

  return (
    <div className="chat-page">
      <div className="container mx-auto max-w-3xl p-4 h-screen flex flex-col justify-center relative z-10">
        <Card className="chat-container flex-1 flex flex-col p-6 mb-4 max-h-[85vh]">
          <div className="flex justify-between items-center mb-6 pb-4 border-b">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-semibold bg-gradient-to-r from-primary/90 to-primary bg-clip-text text-transparent">
                AI Chat Assistant
              </h1>
              <ThemeToggle />
            </div>
            <div className="flex gap-3">
              {speechHandler.getIsSpeaking() && (
                <Button
                  variant="destructive"
                  size="icon"
                  onClick={stopSpeaking}
                  title="Stop AI speaking"
                  className="control-button"
                >
                  <Square className="h-4 w-4" />
                </Button>
              )}
              <Button
                variant={isConversationMode ? "default" : "outline"}
                size="icon"
                onClick={toggleConversationMode}
                title={isConversationMode ? "Disable conversation mode" : "Enable conversation mode"}
                className="control-button"
              >
                <MessageSquare className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => clearChat.mutate()}
                className="control-button"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <ScrollArea className="flex-1 pr-4">
            {isLoading ? (
              <div className="flex justify-center items-center h-full">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : (
              <div className="space-y-6">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${
                      message.role === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={`message-bubble ${
                        message.role === "user"
                          ? "message-bubble-user"
                          : "message-bubble-ai"
                      }`}
                      onClick={() => message.role === "assistant" && speechHandler.speak(message.content, "ThT5KcBeYPX3keUQqHPh")}
                      title={message.role === "assistant" ? "Click to hear this response" : undefined}
                    >
                      {message.content}
                    </div>
                  </div>
                ))}
                {sendMessage.isPending && (
                  <div className="flex justify-start">
                    <div className="message-bubble message-bubble-ai">
                      <div className="flex items-center gap-2">
                        <div className="animate-pulse w-2 h-2 bg-primary rounded-full"></div>
                        <div className="animate-pulse w-2 h-2 bg-primary rounded-full delay-150"></div>
                        <div className="animate-pulse w-2 h-2 bg-primary rounded-full delay-300"></div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>

          <form onSubmit={handleSubmit} className="flex gap-3 mt-6 pt-4 border-t">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={isConversationMode ? "Listening..." : (sendMessage.isPending ? "AI is thinking..." : "Type your message...")}
              className="flex-1 bg-white/50 focus:bg-white dark:bg-gray-800/50 dark:focus:bg-gray-800 transition-colors"
              disabled={sendMessage.isPending || isConversationMode}
            />
            <Button
              type="button"
              variant={isListening ? "destructive" : "outline"}
              size="icon"
              onClick={toggleListening}
              disabled={!speechHandler.isSupported() || sendMessage.isPending}
              className={`mic-button ${isListening ? 'active' : ''}`}
            >
              {isListening ? (
                <MicOff className="h-4 w-4" />
              ) : (
                <Mic className="h-4 w-4" />
              )}
            </Button>
            <Button
              type="submit"
              disabled={!input.trim() || sendMessage.isPending || isConversationMode}
              className="send-button bg-primary/90"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}