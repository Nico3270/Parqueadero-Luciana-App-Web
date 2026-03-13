"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";

import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import CssBaseline from "@mui/material/CssBaseline";
import Divider from "@mui/material/Divider";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";

import MenuIcon from "@mui/icons-material/Menu";
import LocalParkingIcon from "@mui/icons-material/LocalParking";
import LogoutIcon from "@mui/icons-material/Logout";
import LoginIcon from "@mui/icons-material/Login";

interface Props {
  /**
   * Injected by the documentation to work in an iframe.
   * You won't need it on your project.
   */
  window?: () => Window;
}

type Role = "ADMIN" | "OPERATOR";

type NavItem = {
  label: string;
  href: string;
};

const drawerWidth = 300;

// Define acá tus rutas protegidas por rol
const NAV_BY_ROLE: Record<Role, NavItem[]> = {
  ADMIN: [
    { label: "Dashboard", href: "/dashboard" },
    { label: "Ingresos", href: "/ingresos" },
    { label: "Vehículos", href: "/vehiculos" },
    { label: "Mensualidades", href: "/mensualidades" },
    { label: "Reportes", href: "/reportes" },
    { label: "Ajustes", href: "/ajustes" },
  ],
  OPERATOR: [
    { label: "Ingresos", href: "/ingresos" },
    { label: "Vehículos", href: "/vehiculos" },
    { label: "Mensualidades", href: "/mensualidades" },
  ],
};

function getRole(session: any): Role | null {
  const role = session?.user?.role;
  return role === "ADMIN" || role === "OPERATOR" ? role : null;
}

export default function ParkingAppBar(props: Props) {
  const { window } = props;

  const pathname = usePathname();
  const router = useRouter();
  const { data: session, status } = useSession();

  const [mobileOpen, setMobileOpen] = React.useState(false);

  const role = React.useMemo(() => getRole(session), [session]);
  const navItems = React.useMemo<NavItem[]>(
    () => (role ? NAV_BY_ROLE[role] ?? [] : []),
    [role]
  );

  const handleDrawerToggle = () => {
    setMobileOpen((prevState) => !prevState);
  };

  const container =
    window !== undefined ? () => window().document.body : undefined;

  async function handleAuthAction() {
    // Si no hay sesión, vamos al login
    if (!session) {
      router.push("/auth/login");
      return;
    }

    // Si hay sesión, cerramos con NextAuth (cliente)
    // callbackUrl asegura redirección al login
    await signOut({ callbackUrl: "/auth/login" });
  }

  const drawer = (
    <Box
      onClick={handleDrawerToggle}
      sx={{
        textAlign: "center",
        height: "100%",
        bgcolor: "#1F1F1F",
        color: "#fff",
      }}
    >
      <Box sx={{ py: 2 }}>
        <Stack
          component={Link}
          href="/"
          direction="row"
          spacing={1}
          alignItems="center"
          justifyContent="center"
          sx={{
            textDecoration: "none",
            color: "inherit",
            px: 2,
            py: 1,
            borderRadius: 999,
            mx: "auto",
            width: "fit-content",
            "&:hover": { bgcolor: "rgba(255,255,255,0.06)" },
          }}
        >
          <LocalParkingIcon sx={{ opacity: 0.9 }} />
          <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: -0.3 }}>
            Parqueadero Luca
          </Typography>
        </Stack>
      </Box>

      <Divider sx={{ borderColor: "rgba(255,255,255,0.08)" }} />

      <List sx={{ py: 1 }}>
        {session &&
          navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/" && pathname?.startsWith(item.href + "/"));

            return (
              <ListItem key={item.href} disablePadding>
                <ListItemButton
                  component={Link}
                  href={item.href}
                  sx={{
                    textAlign: "center",
                    py: 1.35,
                    mx: 1.25,
                    borderRadius: 2.5,
                    color: isActive ? "#fff" : "rgba(255,255,255,0.78)",
                    bgcolor: isActive ? "rgba(255,255,255,0.11)" : "transparent",
                    "&:hover": {
                      bgcolor: isActive
                        ? "rgba(255,255,255,0.15)"
                        : "rgba(255,255,255,0.07)",
                    },
                  }}
                >
                  <ListItemText
                    primary={item.label}
                    primaryTypographyProps={{
                      fontWeight: 700,
                      letterSpacing: -0.15,
                      fontSize: 15,
                    }}
                  />
                </ListItemButton>
              </ListItem>
            );
          })}

        {!session && status !== "loading" && (
          <Box sx={{ px: 2, py: 1.5, color: "rgba(255,255,255,0.65)" }}>
            <Typography variant="body2">
              Inicia sesión para ver el menú.
            </Typography>
          </Box>
        )}
      </List>

      <Box sx={{ px: 1.25, pb: 2 }}>
        <Divider sx={{ borderColor: "rgba(255,255,255,0.08)", mb: 1.5 }} />
        <Button
          fullWidth
          onClick={handleAuthAction}
          startIcon={session ? <LogoutIcon /> : <LoginIcon />}
          disabled={status === "loading"}
          sx={{
            textTransform: "none",
            fontWeight: 750,
            letterSpacing: -0.2,
            borderRadius: 2.5,
            py: 1.1,
            color: "#fff",
            bgcolor: "rgba(255,255,255,0.10)",
            "&:hover": { bgcolor: "rgba(255,255,255,0.14)" },
          }}
        >
          {session ? "Cerrar sesión" : "Iniciar sesión"}
        </Button>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: "flex" }}>
      <CssBaseline />

      <AppBar
        component="nav"
        elevation={0}
        sx={{
          bgcolor: "#1F1F1F",
          color: "#fff",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <Toolbar sx={{ minHeight: 68, gap: 1 }}>
          {/* Mobile menu */}
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            disabled={!session || navItems.length === 0}
            sx={{
              mr: 1,
              display: { sm: "none" },
              opacity: !session || navItems.length === 0 ? 0.5 : 1,
            }}
          >
            <MenuIcon />
          </IconButton>

          {/* Left brand */}
          <Stack
            component={Link}
            href="/"
            direction="row"
            spacing={1}
            alignItems="center"
            sx={{
              textDecoration: "none",
              color: "inherit",
              flexShrink: 0,
              px: 1.25,
              py: 0.85,
              borderRadius: 999,
              "&:hover": { bgcolor: "rgba(255,255,255,0.06)" },
            }}
          >
            <LocalParkingIcon sx={{ opacity: 0.9 }} />
            <Typography
              variant="h6"
              component="div"
              sx={{
                display: { xs: "none", sm: "block" },
                fontWeight: 850,
                letterSpacing: -0.35,
              }}
            >
              Parqueadero
            </Typography>

            <Typography
              variant="subtitle1"
              component="div"
              sx={{
                display: { xs: "block", sm: "none" },
                fontWeight: 850,
                letterSpacing: -0.35,
              }}
            >
              Parqueadero
            </Typography>
          </Stack>

          {/* Desktop nav (más distribuido y más grande) */}
          <Box
            sx={{
              display: { xs: "none", sm: "flex" },
              flex: 1,
              justifyContent: "center",
              px: 2,
            }}
          >
            {session && navItems.length > 0 && (
              <Box
                sx={{
                  width: "100%",
                  maxWidth: 1100, // más ancho para ocupar mejor pantalla
                  display: "grid",
                  gridAutoFlow: "column",
                  gridAutoColumns: "1fr",
                  gap: 1,
                  alignItems: "center",
                }}
              >
                {navItems.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    (item.href !== "/" &&
                      pathname?.startsWith(item.href + "/"));

                  return (
                    <Button
                      key={item.href}
                      component={Link}
                      href={item.href}
                      sx={{
                        width: "100%",
                        color: isActive ? "#fff" : "rgba(255,255,255,0.80)",
                        textTransform: "none",
                        fontWeight: 750,
                        letterSpacing: -0.2,
                        borderRadius: 999,
                        px: 2.25,
                        py: 1.15, // más alto
                        fontSize: 15.5, // más grande
                        bgcolor: isActive
                          ? "rgba(255,255,255,0.12)"
                          : "transparent",
                        "&:hover": {
                          bgcolor: isActive
                            ? "rgba(255,255,255,0.16)"
                            : "rgba(255,255,255,0.07)",
                        },
                      }}
                    >
                      {item.label}
                    </Button>
                  );
                })}
              </Box>
            )}
          </Box>

          {/* Right auth button */}
          {/* <Box sx={{ display: "flex", alignItems: "center" }}>
            <Tooltip title={session ? "Cerrar sesión" : "Iniciar sesión"}>
              <span>
                <Button
                  onClick={handleAuthAction}
                  startIcon={session ? <LogoutIcon /> : <LoginIcon />}
                  disabled={status === "loading"}
                  sx={{
                    color: "#fff",
                    textTransform: "none",
                    fontWeight: 800,
                    letterSpacing: -0.2,
                    borderRadius: 999,
                    px: 2,
                    py: 1.05,
                    bgcolor: "rgba(255,255,255,0.10)",
                    "&:hover": { bgcolor: "rgba(255,255,255,0.14)" },
                  }}
                >
                  {session ? "Salir" : "Entrar"}
                </Button>
              </span>
            </Tooltip>
          </Box> */}
        </Toolbar>
      </AppBar>

      {/* Mobile Drawer */}
      <nav>
        <Drawer
          container={container}
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true,
          }}
          sx={{
            display: { xs: "block", sm: "none" },
            "& .MuiDrawer-paper": {
              boxSizing: "border-box",
              width: drawerWidth,
              bgcolor: "#1F1F1F",
              color: "#fff",
            },
          }}
        >
          {drawer}
        </Drawer>
      </nav>

      {/* Main placeholder (igual que el ejemplo) */}
      <Box component="main" sx={{ p: 3 }}>
        <Toolbar />
      </Box>
    </Box>
  );
}