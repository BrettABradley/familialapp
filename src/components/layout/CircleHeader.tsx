import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LogOut, Users, Calendar, User, Pin, MessageSquare, Image, TreeDeciduous, ChevronDown } from "lucide-react";
import icon from "@/assets/icon.png";

interface Circle {
  id: string;
  name: string;
  owner_id?: string;
}

interface CircleHeaderProps {
  circles: Circle[];
  selectedCircle: string;
  onCircleChange: (circleId: string) => void;
  onSignOut: () => void;
  showNav?: boolean;
}

export function CircleHeader({
  circles,
  selectedCircle,
  onCircleChange,
  onSignOut,
  showNav = true,
}: CircleHeaderProps) {
  const currentCircle = circles.find((c) => c.id === selectedCircle);

  return (
    <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2">
            <img src={icon} alt="Familial" className="h-8 w-auto" />
            <span className="font-serif text-lg font-bold text-foreground">Familial</span>
          </Link>
          {circles.length > 0 && (
            <>
              <span className="text-muted-foreground text-lg">/</span>
              {circles.length === 1 ? (
                <span className="font-medium text-foreground">
                  {currentCircle?.name || "Circle"}
                </span>
              ) : (
                <Select value={selectedCircle} onValueChange={onCircleChange}>
                  <SelectTrigger className="w-fit min-w-[120px] h-8 border-none bg-transparent hover:bg-secondary/50 font-medium text-foreground gap-1">
                    <SelectValue placeholder="Select circle">
                      {currentCircle?.name || "Select circle"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {circles.map((circle) => (
                      <SelectItem key={circle.id} value={circle.id}>
                        {circle.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </>
          )}
        </div>
        {showNav && (
          <div className="flex items-center gap-2 md:gap-4">
            <Link to="/fridge">
              <Button variant="ghost" size="sm">
                <Pin className="w-4 h-4 md:mr-2" />
                <span className="hidden md:inline">Fridge</span>
              </Button>
            </Link>
            <Link to="/events">
              <Button variant="ghost" size="sm">
                <Calendar className="w-4 h-4 md:mr-2" />
                <span className="hidden md:inline">Events</span>
              </Button>
            </Link>
            <Link to="/albums">
              <Button variant="ghost" size="sm">
                <Image className="w-4 h-4 md:mr-2" />
                <span className="hidden md:inline">Albums</span>
              </Button>
            </Link>
            <Link to="/family-tree">
              <Button variant="ghost" size="sm">
                <TreeDeciduous className="w-4 h-4 md:mr-2" />
                <span className="hidden md:inline">Tree</span>
              </Button>
            </Link>
            <Link to="/messages">
              <Button variant="ghost" size="sm">
                <MessageSquare className="w-4 h-4 md:mr-2" />
                <span className="hidden md:inline">Messages</span>
              </Button>
            </Link>
            <Link to="/circles">
              <Button variant="ghost" size="sm">
                <Users className="w-4 h-4 md:mr-2" />
                <span className="hidden md:inline">Circles</span>
              </Button>
            </Link>
            <Link to="/profile">
              <Button variant="ghost" size="sm">
                <User className="w-4 h-4 md:mr-2" />
                <span className="hidden md:inline">Profile</span>
              </Button>
            </Link>
            <Button variant="ghost" size="sm" onClick={onSignOut}>
              <LogOut className="w-4 h-4 md:mr-2" />
              <span className="hidden md:inline">Sign Out</span>
            </Button>
          </div>
        )}
      </div>
    </header>
  );
}
