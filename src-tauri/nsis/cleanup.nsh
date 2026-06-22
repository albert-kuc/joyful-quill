!macro NSIS_HOOK_POSTUNINSTALL
  RMDir /r "$LOCALAPPDATA\JoyfulQuill"
  RMDir /r "$LOCALAPPDATA\com.qc.joyfull-quill"
!macroend
