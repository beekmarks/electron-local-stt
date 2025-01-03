```mermaid
graph TD
    subgraph Electron Application
        subgraph Main Process
            M[Main Process]
            IPC[IPC Main]
        end

        subgraph Renderer Process
            R[Renderer Process]
            IPCR[IPC Renderer]
            
            subgraph Audio Processing Chain
                MA[Microphone Audio Input]
                DA[Desktop Audio Input]
                AN[Audio Analyzer]
                VOX[VOX System]
                style VOX fill:#f9f,stroke:#333,stroke-width:2px
                
                subgraph VOX Components
                    TH[Threshold Detection]
                    HY[Hysteresis Control]
                    DB[Debounce Timer]
                    RMS[RMS Calculator]
                end
            end
            
            subgraph Whisper Integration
                WM[Whisper Model]
                TR[Transcription Engine]
            end
            
            subgraph UI Components
                VD[Volume Display]
                SD[Speaker Display]
                TD[Transcription Display]
            end
        end
        
        subgraph Storage
            IDB[(IndexedDB)]
            FS[File System]
        end
    end

    %% Audio Flow
    MA --> AN
    DA --> AN
    AN --> RMS
    RMS --> TH
    TH --> HY
    HY --> DB
    DB --> VOX
    
    %% Speaker Detection Flow
    VOX --> SD
    
    %% Transcription Flow
    VOX --> WM
    WM --> TR
    TR --> TD
    
    %% Volume Display
    AN --> VD
    
    %% Storage Flow
    WM <--> IDB
    WM <--> FS
    
    %% IPC Communication
    M <--> IPC
    IPC <--> IPCR
    IPCR <--> R

classDef process fill:#e1f5fe,stroke:#01579b,stroke-width:2px;
classDef storage fill:#fff3e0,stroke:#ff6f00,stroke-width:2px;
classDef audio fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px;
classDef ui fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px;

class M,R process;
class IDB,FS storage;
class MA,DA,AN,VOX audio;
class VD,SD,TD ui;
```

# Architecture Diagram

This diagram illustrates the main components and data flow of the Real-time Local Speech-to-Text system with VOX-Style Speaker Detection. Key features include:

## Main Components

1. **Audio Processing Chain**
   - Dual audio input (Microphone and Desktop)
   - VOX system with hysteresis and debounce
   - RMS-based level detection
   - Professional-grade frequency analysis

2. **Speaker Detection**
   - Threshold-based detection
   - Anti-chatter system
   - Real-time speaker switching

3. **Transcription System**
   - Local Whisper model
   - Real-time processing
   - Offline operation

4. **Storage System**
   - IndexedDB for model storage
   - Local file system integration

## Data Flow

- Audio signals are processed through the VOX system
- Speaker detection influences transcription segmentation
- All processing happens locally within the Electron renderer process
- Main process handles system integration and file operations

## Technical Notes

- The VOX system (highlighted in pink) represents the core innovation
- Electron's IPC system handles cross-process communication
- Storage systems manage model persistence and file operations
- UI components provide real-time feedback and display
