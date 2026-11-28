using System;
using System.Text;
using System.Runtime.InteropServices;
using System.ComponentModel;

public static class AppContainerLauncher
{
    private const string ProfileName =
        "WellnessHub.ReportSandbox";

    private const uint EXTENDED_STARTUPINFO_PRESENT = 0x00080000;
    private const uint CREATE_NO_WINDOW = 0x08000000;

    [StructLayout(LayoutKind.Sequential)]
    private struct SECURITY_CAPABILITIES
    {
        public IntPtr AppContainerSid;
        public IntPtr Capabilities;
        public uint CapabilityCount;
        public uint Reserved;
    }

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    private struct STARTUPINFO
    {
        public uint cb;
        public string lpReserved;
        public string lpDesktop;
        public string lpTitle;
        public uint dwX;
        public uint dwY;
        public uint dwXSize;
        public uint dwYSize;
        public uint dwXCountChars;
        public uint dwYCountChars;
        public uint dwFillAttribute;
        public uint dwFlags;
        public ushort wShowWindow;
        public ushort cbReserved2;
        public IntPtr lpReserved2;
        public IntPtr hStdInput;
        public IntPtr hStdOutput;
        public IntPtr hStdError;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct STARTUPINFOEX
    {
        public STARTUPINFO StartupInfo;
        public IntPtr lpAttributeList;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct PROCESS_INFORMATION
    {
        public IntPtr hProcess;
        public IntPtr hThread;
        public uint dwProcessId;
        public uint dwThreadId;
    }

    [DllImport("userenv.dll", CharSet = CharSet.Unicode)]
    private static extern int
        DeriveAppContainerSidFromAppContainerName(
            string name,
            out IntPtr sid
        );

    [DllImport("advapi32.dll")]
    private static extern IntPtr FreeSid(IntPtr sid);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool
        InitializeProcThreadAttributeList(
            IntPtr list,
            int count,
            int flags,
            ref IntPtr size
        );

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool UpdateProcThreadAttribute(
        IntPtr list,
        uint flags,
        IntPtr attribute,
        IntPtr value,
        IntPtr size,
        IntPtr previous,
        IntPtr returnSize
    );

    [DllImport("kernel32.dll")]
    private static extern void
        DeleteProcThreadAttributeList(IntPtr list);

    [DllImport("kernel32.dll",
        CharSet = CharSet.Unicode,
        SetLastError = true)]
    private static extern bool CreateProcessW(
        string application,
        StringBuilder commandLine,
        IntPtr processAttributes,
        IntPtr threadAttributes,
        bool inheritHandles,
        uint creationFlags,
        IntPtr environment,
        string currentDirectory,
        ref STARTUPINFOEX startupInfo,
        out PROCESS_INFORMATION processInformation
    );

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern uint WaitForSingleObject(
        IntPtr handle,
        uint milliseconds
    );

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool GetExitCodeProcess(
        IntPtr process,
        out uint exitCode
    );

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool TerminateProcess(
        IntPtr process,
        uint exitCode
    );

    [DllImport("kernel32.dll")]
    private static extern bool CloseHandle(IntPtr handle);

    public static uint Run(
        string executable,
        string arguments,
        string workingDirectory
    )
    {
        IntPtr sid = IntPtr.Zero;
        IntPtr attributes = IntPtr.Zero;
        IntPtr capabilities = IntPtr.Zero;
        IntPtr environment = IntPtr.Zero;

        bool initialized = false;

        PROCESS_INFORMATION process =
            new PROCESS_INFORMATION();

        try
        {
            int result =
                DeriveAppContainerSidFromAppContainerName(
                    ProfileName, out sid
                );

            if (result != 0)
                Marshal.ThrowExceptionForHR(result);

            SECURITY_CAPABILITIES security =
                new SECURITY_CAPABILITIES();

            security.AppContainerSid = sid;
            security.Capabilities = IntPtr.Zero;
            security.CapabilityCount = 0;
            security.Reserved = 0;

            int securitySize = Marshal.SizeOf(
                typeof(SECURITY_CAPABILITIES)
            );

            capabilities =
                Marshal.AllocHGlobal(securitySize);

            Marshal.StructureToPtr(
                security, capabilities, false
            );

            IntPtr size = IntPtr.Zero;

            InitializeProcThreadAttributeList(
                IntPtr.Zero, 1, 0, ref size
            );

            attributes = Marshal.AllocHGlobal(size);

            if (!InitializeProcThreadAttributeList(
                attributes, 1, 0, ref size))
                throw new Win32Exception(
                    Marshal.GetLastWin32Error()
                );

            initialized = true;

            if (!UpdateProcThreadAttribute(
                attributes,
                0,
                new IntPtr(0x00020009),
                capabilities,
                new IntPtr(securitySize),
                IntPtr.Zero,
                IntPtr.Zero))
                throw new Win32Exception(
                    Marshal.GetLastWin32Error()
                );

            STARTUPINFOEX startup = new STARTUPINFOEX();

            startup.StartupInfo.cb = (uint)
                Marshal.SizeOf(typeof(STARTUPINFOEX));

            startup.lpAttributeList = attributes;

            // Do not inherit backend environment variables.
         string systemRoot =
    Environment.GetFolderPath(
        Environment.SpecialFolder.Windows
    );

string systemDrive =
    System.IO.Path.GetPathRoot(systemRoot)
        .TrimEnd('\\');

string environmentBlock =
    "ComSpec=" + systemRoot + "\\System32\\cmd.exe\0" +
    "Path=" + systemRoot + "\\System32;" + systemRoot + "\0" +
    "SystemDrive=" + systemDrive + "\0" +
    "SystemRoot=" + systemRoot + "\0" +
    "WINDIR=" + systemRoot + "\0\0";

environment = Marshal.StringToHGlobalUni(
    environmentBlock
);

            StringBuilder command = new StringBuilder(
                "\"" + executable + "\" " + arguments
            );

            bool created = CreateProcessW(
                executable,
                command,
                IntPtr.Zero,
                IntPtr.Zero,
                false,
                EXTENDED_STARTUPINFO_PRESENT |
                CREATE_NO_WINDOW |
                0x00000400,
                environment,
                workingDirectory,
                ref startup,
                out process
            );

            if (!created)
                throw new Win32Exception(
                    Marshal.GetLastWin32Error()
                );

            uint wait = WaitForSingleObject(
                process.hProcess, 15000
            );

            if (wait != 0)
            {
                TerminateProcess(process.hProcess, 1);
                throw new Exception(
                    "Sandbox process timed out or wait failed"
                );
            }

            uint exitCode;

            if (!GetExitCodeProcess(
                process.hProcess, out exitCode))
                throw new Win32Exception(
                    Marshal.GetLastWin32Error()
                );

            return exitCode;
        }
        finally
        {
            if (process.hThread != IntPtr.Zero)
                CloseHandle(process.hThread);

            if (process.hProcess != IntPtr.Zero)
                CloseHandle(process.hProcess);

            if (initialized)
                DeleteProcThreadAttributeList(attributes);

            if (attributes != IntPtr.Zero)
                Marshal.FreeHGlobal(attributes);

            if (capabilities != IntPtr.Zero)
                Marshal.FreeHGlobal(capabilities);

            if (environment != IntPtr.Zero)
                Marshal.FreeHGlobal(environment);

            if (sid != IntPtr.Zero)
                FreeSid(sid);
        }
    }
}