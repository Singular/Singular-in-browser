export const TUTORIALS = Object.freeze([
  {
    id: "two-ellipses-groebner",
    title: "Two ellipses and a Groebner basis",
    source: "PDF p. 13",
    pdfPage: 13,
    markdown: `This computes a lexicographic Gröbner basis for the ideal
$$I=\\langle 2x^2-xy+2y^2-2,\\;2x^2-3xy+3y^2-2\\rangle\\subset\\mathbb Q[y,x].$$
With the variable order $y>x$, the basis eliminates $y$ and produces a univariate polynomial in $x$. The output is used to solve the intersection of the two ellipses: first solve $4x^4-5x^2+1=0$, then recover $y$ from the linear relation $3y+8x^3-8x=0$.

![Buchberger's algorithm for the intersection of two ellipses](tutorials/images/twoell2.png)`,
    code: `ring R=0,(y,x),lp;
ideal I = 2x2-xy+2y2-2, 2x2-3xy+3y2-2;
std(I);`
  },
  {
    id: "linear-system-standard-basis",
    title: "A linear system",
    source: "PDF p. 29",
    pdfPage: 29,
    markdown: `The generators are linear forms in $x_1,\\ldots,x_5$. Computing a reduced Gröbner basis with lexicographic order is the polynomial analogue of Gaussian elimination: the Gröbner basis spans the same linear ideal but presents it in echelon form. The result says that the original system is equivalent to
$$x_3+x_4=0,\\qquad x_1+x_2+x_5=0.$$`,
    code: `ring R = 0,(x(1..5)),lp;
ideal I = x(1) + x(2) + x(5),
x(1) + x(2) + 2*x(3) + 2*x(4) + x(5),
x(1) + x(2) + x(3) + x(4) + x(5);
option(redSB);
std(I);`
  },
  {
    id: "monomial-orderings",
    title: "Monomial orderings and leading terms",
    source: "PDF pp. 57-58",
    pdfPage: 57,
    pdfPageEnd: 58,
    markdown: `This script compares the same monomials under Singular's lexicographic order \`lp\`, degree reverse lexicographic order \`dp\`, and local lexicographic order \`ls\`. The Boolean outputs show how a monomial order changes which exponent vector is considered larger. The examples illustrate that \`lp\` prioritizes the first differing exponent, \`dp\` prioritizes total degree with a reverse tie-break, and \`ls\` is a local ordering in which $1$ can be larger than non-constant monomials.

For the polynomial $f=5x^2y+xy^2$ in lexicographic order, this script computes the leading term $LT(f)$, the leading coefficient $LC(f)$, and the leading monomial $L(f)$. The output confirms
$$LT(f)=5x^2y,\\qquad LC(f)=5,\\qquad L(f)=x^2y.$$`,
    code: `ring R=0,(x,y,z),lp;
x>y;
y>z;
xy2>y3z4;
x3y2z4>x3yz5;
ring R=0,(x,y,z),dp;
x>y;
y>z;
xy2>y3z4;
x3y2z4>x3yz5;
ring R=0,(x,y,z),ls;
1>z;
z>y;
y>x;
xy2>y3z4;
x3y2z4>x3yz5;
ring R=0,(x,y,z),lp;
poly f = 5x2y+xy2;
lead(f);
leadcoef(f);
leadmonom(f);`
  },
  {
    id: "normal-form-division",
    title: "Normal forms and division",
    source: "PDF p. 72",
    pdfPage: 72,
    markdown: `This initializes the polynomial ring and the ideal
$$I=\\langle x^2-1,\\;y-1\\rangle\\subset\\mathbb Q[x,y]$$
used in the following normal-form computations. The example studies how to reduce $x^2y+x$ modulo a Gröbner basis of $I$.

Continuing the previous setup, this computes a standard basis of $I$ and reduces $x^2y+x$ modulo that basis. The normal form is $x+1$, representing the class of $x^2y+x$ in the quotient ring $\\mathbb Q[x,y]/I$.

The \`division\` command returns more than the normal form: it gives coefficients expressing the input polynomial in terms of the basis, the remainder, and the unit used by the division algorithm. In this global ordering example, the unit is $1$, so the output is a standard expression for $x^2y+x$ modulo the Gröbner basis of $I$.`,
    code: `ring R=0,(x,y),lp;
ideal I = x2-1,y-1;
I=std(I);
I;
reduce(x2y+x,I);
division(x2y+x,I);`
  },
  {
    id: "reduced-standard-basis",
    title: "Reduced standard bases",
    source: "PDF pp. 77-78",
    pdfPage: 77,
    pdfPageEnd: 78,
    markdown: `The ideal
$$I=\\langle t^2-x,\\;t^3-y,\\;t^4-z\\rangle\\subset\\mathbb Q[t,z,y,x]$$
encodes a parametrized affine curve. The lexicographic Gröbner basis eliminates powers of $t$ and reveals algebraic relations among $x,y,z$, including $y^2-x^3$ and $z-x^2$. The basis is already reduced in this example.

This example shows that Singular's default \`std\` output need not be reduced. After setting \`option(redSB)\`, the same ideal $\\langle x+y,y\\rangle$ is represented by the reduced Gröbner basis $\\{y,x\\}$.`,
    code: `ring R=0,(t,z,y,x),lp;
ideal I = t2-x,t3-y,t4-z;
std(I);
ring R=0,(x,y),lp;
ideal I = x+y,y;
std(I);
option(redSB);
std(I);`
  },
  {
    id: "local-division",
    title: "Division in a local ordering",
    source: "PDF p. 83",
    pdfPage: 83,
    markdown: `Using the local ordering \`ls\`, this computes a weak normal form of $y^2+x^2$ modulo $\\langle x-x^2,y\\rangle$. The output corresponds to the identity
$$(1-x)(y^2+x^2)=(y-xy)y+x(x-x^2),$$
so the weak normal form is zero after multiplication by the unit $1-x$.`,
    code: `ring R=0,(x,y),ls;
division(y^2+x^2,ideal(x-x^2,y));`
  },
  {
    id: "four-points",
    title: "Four points",
    source: "PDF p. 90",
    pdfPage: 90,
    markdown: `This computes the ideal of the union of four affine points
$$(0,0),\\;(1,0),\\;(0,1),\\;(1,1)$$
by intersecting their maximal ideals. The resulting Gröbner basis
$$\\langle y^2-y,\\;x^2-x\\rangle$$
cuts out exactly those four points in $\\mathbb A^2$.

![Four points as the intersection of two pairs of lines](tutorials/images/4points.png)`,
    code: `ring R=0,(x,y),lp;
ideal I1 = x,y;
ideal I2 = x-1,y;
ideal I3 = x,y-1;
ideal I4 = x-1,y-1;
std(intersect(I1,I2,I3,I4));`
  },
  {
    id: "twisted-cubic-projection",
    title: "Projection of the twisted cubic",
    source: "PDF pp. 92-93",
    pdfPage: 92,
    pdfPageEnd: 93,
    markdown: `For the affine twisted cubic $C=V(y-x^2,z-x^3)\\subset\\mathbb A^3$, a lexicographic Gröbner basis with $x>y>z$ eliminates $x$. The elimination ideal in $\\mathbb Q[y,z]$ is
$$I\\cap\\mathbb Q[y,z]=\\langle y^3-z^2\\rangle,$$
which is the equation of the projection of $C$ to the $(y,z)$-plane.

This is the same elimination as in the previous script, now using Singular's \`eliminate(I,x)\` command. It directly returns the generator $y^3-z^2$ of $I\\cap\\mathbb Q[y,z]$.

![Projection of the twisted cubic](tutorials/images/twistedcubicP.jpg)`,
    code: `ring R=0,(x,y,z),lp;
ideal I = y-x2,z-x3;
std(I);
eliminate(I,x);`
  },
  {
    id: "parametrized-surface",
    title: "A parametrized surface",
    source: "PDF p. 95",
    pdfPage: 95,
    markdown: `The ideal
$$I=\\langle x-st,\\;y-t,\\;z-s^2\\rangle\\subset K[s,t,x,y,z]$$
encodes the graph of a polynomial map. Eliminating $s,t$ yields the closure of the image in the $x,y,z$ variables. The first Gröbner basis element gives the equation
$$x^2-y^2z=0,$$
the Whitney umbrella.

![Whitney umbrella](tutorials/images/whitney.jpg)`,
    code: `ring R=0,(s,t,x,y,z),lp;
ideal I = x-st, y-t, z-s2;
std(I);`
  },
  {
    id: "whitney-umbrella-kernel",
    title: "Steiner surface kernel",
    source: "PDF p. 100",
    pdfPage: 100,
    markdown: `The quotient ring $Q=K[t_1,t_2,t_3]/\\langle t_1^2+t_2^2+t_3^2-1\\rangle$ represents the unit sphere. The map sends
$$x\\mapsto t_1t_2,\\quad y\\mapsto t_1t_3,\\quad z\\mapsto t_2t_3.$$
Computing the kernel gives the implicit equation of the image, the Steiner surface:
$$x^2y^2+x^2z^2+y^2z^2-xyz=0.$$

![Steiner surface over the reals](tutorials/images/steiner2.jpg)`,
    code: `ring S = 0,(x,y,z),dp;
ring R = 0,(t1,t2,t3),dp;
ideal I = t1^2+t2^2+t3^2-1;
qring Q = std(I);
map f = S, ideal(t1*t2, t1*t3, t2*t3);
setring S;
kernel(Q,f);`
  },
  {
    id: "circle-parametrization",
    title: "Circle parametrization",
    source: "PDF p. 102",
    pdfPage: 102,
    markdown: `This script encodes the rational map
$$t\\mapsto\\left(\\frac{1-t^2}{1+t^2},\\frac{2t}{1+t^2}\\right)$$
using an auxiliary variable $s$ to saturate away the denominator $1+t^2$. The eliminated equation is
$$x^2+y^2-1=0,$$
so the closure of the image is the unit circle.

![Rational parametrization of the circle](tutorials/images/circlepar.png)`,
    code: `ring R=0,(s,t,x,y),lp;
ideal I = (t2+1)*x-(1-t2), (t2+1)*y-2t, 1-(t2+1)^2*s;
option(redSB);
std(I);`
  },
  {
    id: "nodal-curve",
    title: "A nodal curve",
    source: "PDF p. 108",
    pdfPage: 108,
    markdown: `The nodal curve is defined by $t_1^3+t_1^2-t_2^2=0$. The script computes the image of the rational function $x=t_1/t_2$ on this curve by introducing $s$ to exclude $t_2=0$. The Gröbner basis contains relations expressing $t_1,t_2,s$ in terms of $x$, showing how the rational map leads to a parametrization of the curve.

![Nodal curve](tutorials/images/node.png)`,
    code: `ring R=0,(s,t1,t2,x),lp;
ideal I = t1^3+t1^2-t2^2, t2*x-t1,1-t2*s;
std(I);`
  },
  {
    id: "ideal-quotient-basic",
    title: "An ideal quotient",
    source: "PDF p. 111",
    pdfPage: 111,
    markdown: `For the hypersurface $X=V(xy-zw)\\subset\\mathbb A^4$, the script computes
$$(\\langle xy-zw,z\\rangle : \\langle x\\rangle).$$
The result $\\langle z,y\\rangle$ reflects the residual component obtained after removing the component forced by the factor $x$ in the section $z=0$.`,
    code: `ring R=0,(x,y,z,w),dp;
ideal I = xy-zw;
quotient(I+ideal(z),ideal(x));`
  },
  {
    id: "quotient-and-elimination",
    title: "Quotients and elimination",
    source: "PDF pp. 113-114",
    pdfPage: 113,
    pdfPageEnd: 114,
    markdown: `The ideal $I=\\langle x^2-x,\\;y^2-y\\rangle$ defines the four Boolean points in $\\mathbb A^2$. Taking the quotient by $J=\\langle x-y\\rangle$ removes the points on the diagonal and leaves the residual set cut out by
$$\\langle x+y-1,\\;y^2-y\\rangle,$$
namely $(1,0)$ and $(0,1)$.

![Ideal quotient](tutorials/images/iq.png)

This computes the elimination ideals $I\\cap\\mathbb Q[y]$ and $I\\cap\\mathbb Q[x]$ for the two-ellipse system. The outputs $y^3-y$ and $4x^4-5x^2+1$ give the finite candidate coordinates used to solve the zero-dimensional system.`,
    code: `ring R=0,(x,y),dp;
ideal I = x2-x, y2-y;
ideal J = x-y;
quotient(I, J);
ring R=0,(x,y),lp;
ideal I = 2x2-xy+2y2-2, 2x2-3xy+3y2-2;
eliminate(I,x);
eliminate(I,y);`
  },
  {
    id: "variable-order-effects",
    title: "Variable order effects",
    source: "PDF p. 116",
    pdfPage: 116,
    markdown: `With variable order $y>x$, lexicographic Gröbner basis computation makes the last variable $x$ appear in a univariate equation. The triangular form is used to solve $x$ first, then recover $y$ from the linear relation.

With variable order $x>y$, the Gröbner basis produces a univariate equation in $y$, together with additional equations that filter spurious Cartesian-product candidates. It illustrates the solve-by-elimination workflow for zero-dimensional ideals.

![Buchberger's algorithm for the intersection of two ellipses](tutorials/images/twoell2.png)`,
    code: `ring R=0,(y,x),lp;
ideal I = 2x2-xy+2y2-2, 2x2-3xy+3y2-2;
std(I);
ring R=0,(x,y),lp;
ideal I = 2x2-xy+2y2-2, 2x2-3xy+3y2-2;
std(I);`
  },
  {
    id: "projective-closure",
    title: "Projective closure",
    source: "PDF p. 126",
    pdfPage: 126,
    markdown: `Starting from the affine twisted cubic ideal $\\langle x_1^2-x_2,\\;x_1^3-x_3\\rangle$, the script computes a homogeneous Gröbner basis in $K[x_0,x_1,x_2,x_3]$. The output gives the projective closure ideal
$$\\langle x_2^2-x_1x_3,\\;x_1x_2-x_0x_3,\\;x_1^2-x_0x_2\\rangle.$$`,
    code: `ring R = 0,(x(0..3)),dp;
ideal I = x(1)^2-x(2), x(1)^3-x(3);
std(I);`
  },
  {
    id: "saturation-and-rational-normal-curve",
    title: "Saturation and repeated quotients",
    source: "PDF pp. 130-131",
    pdfPage: 130,
    pdfPageEnd: 131,
    markdown: `For $I=\\langle xy^2\\rangle$ and $J=\\langle y\\rangle$, a single quotient gives $I:J=\\langle xy\\rangle$, while saturation removes all powers of $y$ and gives $I:J^\\infty=\\langle x\\rangle$. This demonstrates how saturation removes embedded multiplicity along $V(J)$.

The $2\\times2$ minors of the matrix
$$\\begin{pmatrix}x_0&x_1&x_2\\\\ t_0^2&t_0t_1&t_1^2\\end{pmatrix}$$
encode the graph of the quadratic Veronese parametrization. Repeatedly quotienting by $\\langle t_0,t_1\\rangle$ saturates away the extraneous component at the origin. The final elimination yields the conic equation $x_0x_2-x_1^2=0$.`,
    code: `LIB "elim.lib";
ring R = 0,(x,y),dp;
ideal I = x*y^2;
ideal J = y;
quotient(I,J);
sat(I,J);
ring R = 0,(t0,t1,x0,x1,x2),lp;
matrix A[2][3] = x0,x1,x2,t0^2,t0*t1,t1^2;
ideal J = minor(A,2);
ideal J1 = quotient(J,ideal(t0,t1));
ideal J2 = quotient(J1,ideal(t0,t1));
ideal J3 = quotient(J2,ideal(t0,t1));
quotient(J3,ideal(t0,t1));`
  },
  {
    id: "degree-five-space-curve",
    title: "A degree five space curve",
    source: "PDF p. 139",
    pdfPage: 139,
    markdown: `This computes the image of a rational map from a plane quintic curve to $\\mathbb P^3$. The graph ideal is saturated by the coordinate functions of the map, then the source variables $t_0,t_1,t_2$ are eliminated. The resulting ideal is generated by three quadrics, and \`slocus\` verifies that the image curve is smooth.

![Degree 5 plane curve with three double points and one triple point](tutorials/images/deg5curve.png)`,
    code: `ring R = 0, (t0,t1,t2,x0,x1,x2,x3), (dp(3),dp(4));
ideal C = t1^5+10*t1^4*t2+20*t1^3*t2^2+130*t1^2*t2^3-20*t1*t2^4
+20*t2^5-2*t1^4*t0-40*t1^3*t2*t0-150*t1^2*t2^2*t0-90*t1*t2^3*t0
-40*t2^4*t0+t1^3*t0^2+30*t1^2*t2*t0^2+110*t1*t2^2*t0^2+20*t2^3*t0^2;
matrix A[2][4] = x0, x1, x2, x3,
t2^3-t2^2*t0, t1*t2^2-t1*t2*t0, t1^2*t2-t1*t2*t0, t1^3-t1^2*t0;
ideal J = C + minor(A,2);
LIB "elim.lib";
ideal G = sat(J,ideal(A[2,1], A[2,2], A[2,3], A[2,4]));
ideal L = eliminate(G,t0*t1*t2);
LIB "sing.lib";
sat(slocus(L),ideal(x0,x1,x2,x3));`
  },
  {
    id: "degree-five-plane-curve",
    title: "A degree five plane curve",
    source: "PDF pp. 141-142",
    pdfPage: 141,
    pdfPageEnd: 142,
    markdown: `This is the same source quintic, mapped to $\\mathbb P^1$ by two quadratic forms. After saturation and elimination, the output is the zero ideal, meaning the closure of the image is all of $\\mathbb P^1$.

Continuing the previous $\\mathbb P^1$ image computation, \`std(G)\` lists generators of the saturated graph ideal. The first two displayed generators are linear in the source variables $t_0,t_1,t_2$, and these linear relations are the input for recovering the inverse map.

The script forms a matrix of coefficients of the generators that are linear in $t_0,t_1,t_2$. Algebraically this is a homogeneous linear system over $K[x_0,x_1]$ whose solutions give the source coordinates as functions of the target coordinates.

The syzygy module of the transposed relation matrix gives a generator for the solution space of the homogeneous linear system. The resulting column vector provides a parametrization of the original quintic curve, hence the inverse data for the birational map.

Substituting the three coordinates obtained from the syzygy computation into the quintic equation $C$ gives zero. This verifies that the recovered parametrization indeed maps into the original curve.

![Three curves in the linear system of quadrics through the singular points of C](tutorials/images/deg5curvelinsys.png)`,
    code: `ring R = 0, (t0,t1,t2,x0,x1), (dp(3),dp(2));
ideal C = t1^5+10*t1^4*t2+20*t1^3*t2^2+130*t1^2*t2^3-20*t1*t2^4
+20*t2^5-2*t1^4*t0-40*t1^3*t2*t0-150*t1^2*t2^2*t0-90*t1*t2^3*t0
-40*t2^4*t0+t1^3*t0^2+30*t1^2*t2*t0^2+110*t1*t2^2*t0^2+20*t2^3*t0^2;
matrix A[2][2] = x0, x1, t1^2-t1*t0, t2^2-t2*t0;
ideal J = C + minor(A,2);
LIB "elim.lib";
ideal G = sat(J,ideal(t1^2-t1*t0, t2^2-t2*t0));
eliminate(G,t0*t1*t2);
std(G);
ideal I = G;
matrix Rel = diff(ideal(t0,t1,t2),ideal(I[1..2]));
matrix Par = syz(transpose(Rel));
subst(C,t0,Par[1,1],t1,Par[2,1],t2,Par[3,1]);`
  },
  {
    id: "highest-corner-jacobian",
    title: "Highest corner of a Jacobian ideal",
    source: "PDF p. 147",
    pdfPage: 147,
    markdown: `For $f=x^5+x^2y^2+y^6$, the Jacobian ideal is
$$J(f)=\\langle 5x^4+2xy^2,\\;2x^2y+6y^5\\rangle.$$
Using the local degree ordering \`ds\`, Singular computes the highest corner of $L(J(f))$ as $y^6$.

Continuing the previous computation, this displays the leading terms of a standard basis of the Jacobian ideal. These monomials generate the lead ideal whose complement in the monomial lattice determines the highest corner.

![Highest corner for the Jacobian ideal of f=x^5+x^2y^2+y^6](tutorials/images/highcorner.png)`,
    code: `ring R =0,(x,y),ds;
poly f = x^5+x^2*y^2+y^6;
ideal J = jacob(f);
highcorner(std(J));
lead(std(J));`
  },
  {
    id: "higher-jacobian-ideal",
    title: "A higher Jacobian ideal",
    source: "PDF p. 150",
    pdfPage: 150,
    markdown: `This computes the highest corner of $\\mathfrak m^2J(f)$ for the same $f=x^5+x^2y^2+y^6$. The result $y^6$ supports the finite-determinacy conclusion that terms of degree at least $7$ may be deleted up to right equivalence.`,
    code: `ring R =0,(x,y),ds;
poly f = x^5+x^2*y^2+y^6;
ideal J = maxideal(2)*jacob(f);
highcorner(std(J));`
  },
  {
    id: "free-resolutions",
    title: "Free resolutions",
    source: "PDF pp. 186-187",
    pdfPage: 186,
    pdfPageEnd: 187,
    markdown: `For the ideal $I=\\langle x,y\\rangle\\subset K[x,y]$, Singular computes a free resolution and displays the first two matrices. This is the length-two Koszul resolution
$$0\\to R\\xrightarrow{(-x,\\;y)^T}R^2\\xrightarrow{(y\\;x)}R\\to R/I\\to0,$$
up to the conventions used for rows, columns, and signs.

For $I=\\langle x_1,x_2,x_3,x_4\\rangle$, the ranks in the resolution are $1,4,6,4,1$. These binomial coefficients are the ranks of the Koszul complex on four independent variables.`,
    code: `ring R=0,(x,y),lp;
ideal I=x,y;
def L=res(I,0);
matrix(L[1]);
matrix(L[2]);
ring R=0,(x(1..4)),lp;
ideal I=x(1..4);
def L=res(I,0);`
  },
  {
    id: "hilbert-polynomial",
    title: "Hilbert polynomial",
    source: "PDF p. 190",
    pdfPage: 190,
    markdown: `The ideal $\\langle x_0^3-x_1^3-x_2^3\\rangle$ defines a projective plane cubic. Singular's \`hilbPoly\` returns the Hilbert polynomial data corresponding to $P_{R/I}(t)=3t$, so the curve has dimension $1$, degree $3$, and arithmetic genus $1$.`,
    code: `ring R=0,(x(0..2)),dp;
ideal I = x(0)^3-x(1)^3 - x(2)^3;
LIB "polylib.lib";
hilbPoly(I);`
  },
  {
    id: "betti-table-twisted-cubic",
    title: "Betti table of the twisted cubic",
    source: "PDF p. 196",
    pdfPage: 196,
    markdown: `For the projective twisted cubic ideal
$$I=\\langle x_2^2-x_1x_3,\\;x_1x_2-x_0x_3,\\;x_1^2-x_0x_2\\rangle,$$
the resolution has the form
$$0\\to R(-3)^2\\to R(-2)^3\\to R\\to R/I\\to0.$$
The Betti table records the three quadratic generators and two cubic syzygies.

![Twisted cubic](tutorials/images/twistedcubic2.jpg)`,
    code: `ring R=0,(x0,x1,x2,x3),dp;
ideal I=x2^2-x1*x3, x1*x2-x0*x3, x1^2-x2*x0;
def L=res(I,0);
print(betti(L),"betti");`
  },
  {
    id: "module-orderings",
    title: "Module orderings",
    source: "PDF pp. 202-203",
    pdfPage: 202,
    pdfPageEnd: 203,
    markdown: `This compares module monomials in $R^2$ using ordering \`(lp,c)\`, where polynomial monomials are compared first and component indices are used only for ties. The Boolean outputs show, for example, that $[0,x]>[y,0]$ because $x>y$ in lexicographic order.

This repeats module-monomial comparisons using \`(c,lp)\`, where the component is compared before the monomial. The change makes $[0,x]>[y,0]$ false, because the second component has lower priority than the first component.

For the vector $f=[x,5x^2y+xy^2]$ in a free module with ordering \`(lp,c)\`, Singular computes the leading monomial, coefficient, and term. The leading term lies in the second component: $5x^2y\\,e_2$.

The same vector $[y+z,x+y]$ is examined under two module orderings. With \`(lp,c)\`, the leading monomial is $x e_2$; with \`(c,lp)\`, the first component has priority and the leading monomial is $y e_1$.`,
    code: `ring R = 0,(x,y),(lp,c);
[1,0]>[0,1];
[x,0]>[y,0];
[0,x]>[y,0];
ring R = 0,(x,y),(c,lp);
[0,x]>[y,0];
[x,0]>[y,0];
ring R=0,(x,y),(lp,c);
vector f = [x, 5x2y+xy2];
leadmonom(f);
leadcoef(f);
lead(f);
ring R=0,(x,y,z),(lp,c);
vector f = [y+z, x+y];
leadmonom(f);
ring R=0,(x,y,z),(c,lp);
vector f = [y+z, x+y];
leadmonom(f);`
  },
  {
    id: "module-reductions",
    title: "Module reductions",
    source: "PDF p. 207",
    pdfPage: 207,
    markdown: `This reduces several vectors modulo a module generated by five columns. The examples illustrate that reduction with a non-standard generating set can depend on choices and may leave nonzero remainders even when a more complete standard basis would reduce further.`,
    code: `ring R = 0,(x(1..5)),(lp,c);
module M = [0,-x(2),0,0,x(1)],
[x(2),0,-x(3),0,0],
[0,x(3),0,-x(4),0],
[0,0,x(4),0,-x(5)],
[-x(1),0,0,x(5),0];
reduce([0,0,0,-x(2)*x(4),x(1)*x(3)],M,1);
reduce([0,0,0,x(1)-x(2)*x(4),x(1)*x(3)],M,1);
reduce([0,0,-x(1)*x(3),x(2)*x(5),0],M,1);`
  },
  {
    id: "module-standard-reduction",
    title: "Reduction by a standard module basis",
    source: "PDF p. 209",
    pdfPage: 209,
    markdown: `With the same module as before, this uses Singular's default reduction, which first computes the necessary standard basis information. The vector now reduces to the simpler normal form $x_1e_4$.`,
    code: `ring R = 0,(x(1..5)),(lp,c);
module M = [0,-x(2),0,0,x(1)],
[x(2),0,-x(3),0,0],
[0,x(3),0,-x(4),0],
[0,0,x(4),0,-x(5)],
[-x(1),0,0,x(5),0];
reduce([0,0,0,x(1)-x(2)*x(4),x(1)*x(3)],M);`
  },
  {
    id: "standard-module-basis",
    title: "A standard basis of a module",
    source: "PDF p. 212",
    pdfPage: 212,
    markdown: `This computes a standard basis for the submodule generated by five vectors in $R^5$. The additional sixth generator is a syzygy-like consequence needed for a standard basis with the chosen module ordering; the printed matrix displays the resulting generators as columns.`,
    code: `ring R = 0,(x(1..5)),(lp,c);
module M = [0,-x(2),0,0,x(1)],
[x(2),0,-x(3),0,0],
[0,x(3),0,-x(4),0],
[0,0,x(4),0,-x(5)],
[-x(1),0,0,x(5),0];
std(M);
print(std(M));`
  },
  {
    id: "sparse-resolution",
    title: "Sparse resolution",
    source: "PDF pp. 223-224",
    pdfPage: 223,
    pdfPageEnd: 224,
    markdown: `For the monomial ideal
$$I=\\langle x_5x_7,\\;x_3x_4x_7,\\;x_3x_4x_6,\\;x_1x_2x_6,\\;x_1x_2x_5\\rangle,$$
\` sres(I,0)\` computes a resolution whose ranks initially are $1,5,6,2$. Singular notes that the resolution is not minimized.

Continuing the previous resolution, \`minres\` removes redundant summands and the Betti table records the minimal graded free resolution. The ranks become $1,5,5,1$, and the table encodes the degrees of the generators and syzygies.`,
    code: `ring R = 0,(x(1..7)),dp;
ideal I = x(5)*x(7), x(3)*x(4)*x(7),
x(3)*x(4)*x(6), x(1)*x(2)*x(6), x(1)*x(2)*x(5);
resolution r = sres(I,0);
r = minres(list(r));
print(betti(r),"betti");`
  },
  {
    id: "syzygy-matrix",
    title: "A syzygy matrix",
    source: "PDF p. 233",
    pdfPage: 233,
    markdown: `The displayed $5\\times5$ matrix defines a module map. The command \`syz(M)\` computes generators of its kernel, i.e. relations among the columns. The output is a column vector of monomial syzygies.`,
    code: `ring R = 0, (x(1..7)),dp;
matrix M[5][5] = -x(6), 0, 0, -x(7), 0,
x(5), 0, 0, 0, -x(3)*x(4), 0,
0, -x(7), 0, 0, x(1)*x(2),
0, x(6), -x(5), 0, 0,
0, 0, x(3)*x(4), x(1)*x(2), 0;
print(syz(M));`
  },
  {
    id: "module-quotient-modulo",
    title: "Module quotient with modulo",
    source: "PDF p. 235",
    pdfPage: 235,
    markdown: `For $A=\\langle x,y\\rangle$ and $B=\\langle x^2,y^2\\rangle$ as submodules of a free rank-one module, \`modulo(A,B)\` computes relations presenting the subquotient $A/B$. The resulting matrix gives the relations among the generators $x$ and $y$ modulo $x^2$ and $y^2$.`,
    code: `ring R=0,(x,y),dp;
module A = x,y;
module B = x2,y2;
print(modulo(A,B));`
  },
  {
    id: "irreducible-monomial-decomposition",
    title: "Irreducible monomial decomposition",
    source: "PDF p. 252",
    pdfPage: 252,
    markdown: `The monomial ideal
$$I=\\langle x_0x_1x_2,\\;x_0^2x_2,\\;x_1^3x_2\\rangle$$
is decomposed into irreducible monomial ideals using \`irreddecMon\`. The output lists components such as $\\langle x_0^2,x_1\\rangle$, $\\langle x_0,x_1^3\\rangle$, and $\\langle x_2\\rangle$.`,
    code: `LIB "monomialideal.lib";
ring R = 0,(x(0..2)),dp;
ideal I = x(0)*x(1)*x(2), x(0)^2*x(2), x(1)^3*x(2);
irreddecMon(I);`
  },
  {
    id: "primary-decomposition",
    title: "Primary decomposition",
    source: "PDF p. 256",
    pdfPage: 256,
    markdown: `This computes a minimal primary decomposition of the same monomial ideal using Singular's general \`primdecGTZ\` algorithm. Each output block contains a primary ideal and its associated prime radical.`,
    code: `LIB "primdec.lib";
ring R = 0,(x(0..2)),dp;
ideal I = x(0)*x(1)*x(2), x(0)^2*x(2), x(1)^3*x(2);
primdecGTZ(I);`
  },
  {
    id: "embedded-primary-decomposition",
    title: "Primary decomposition with embedded parts",
    source: "PDF p. 259",
    pdfPage: 259,
    markdown: `For
$$I=\\langle x_0x_1x_2,\\;x_0^2x_2,\\;x_1^3x_2^2\\rangle,$$
\`primdecGTZ\` returns a decomposition with an additional component. This illustrates how embedded components appear in primary decomposition and how their radicals differ from the minimal primes.

![Primary decomposition with an embedded line](tutorials/images/embedded.png)`,
    code: `LIB "primdec.lib";
ring R = 0,(x(0..2)),dp;
ideal I = x(0)*x(1)*x(2), x(0)^2*x(2), x(1)^3*x(2)^2;
primdecGTZ(I);`
  },
  {
    id: "radicals-after-quotients",
    title: "Radicals after quotients",
    source: "PDF p. 259",
    pdfPage: 259,
    markdown: `Continuing the embedded-component example, radicals of selected ideal quotients recover possible associated primes:
$$\\sqrt{I:x_0^2},\\quad \\sqrt{I:x_2^2},\\quad \\sqrt{I:x_1^3x_2}.$$
For monomial ideals, suitable quotient elements can be chosen monomial, making this computation especially transparent.

![Primary decomposition with an embedded line](tutorials/images/embedded.png)`,
    code: `LIB "primdec.lib";
ring R = 0,(x(0..2)),dp;
ideal I = x(0)*x(1)*x(2), x(0)^2*x(2), x(1)^3*x(2)^2;
radical(quotient(I,x(0)^2));
radical(quotient(I,x(2)^2));
radical(quotient(I,x(1)^3*x(2)));`
  },
  {
    id: "singular-locus-plane-curve",
    title: "Singular locus of a plane curve",
    source: "PDF p. 268",
    pdfPage: 268,
    markdown: `For the plane curve
$$I=\\langle x^4+y^2(y-1)^3\\rangle,$$
\`slocus(I)\` computes the ideal generated by $I$ and its Jacobian conditions. The standard basis of the singular-locus ideal is $\\langle y^3-2y^2+y,\\;x^3\\rangle$.

This decomposes the singular-locus ideal from the previous script. The radicals are $\\langle x,y-1\\rangle$ and $\\langle x,y\\rangle$, so the curve has singular points at $(0,1)$ and $(0,0)$.`,
    code: `LIB "primdec.lib";
ring R = 0,(x,y),dp;
ideal I = x^4 + y^2*(y-1)^3;
ideal singI = std(slocus(I));
singI;
primdecGTZ(singI);`
  },
  {
    id: "endomorphism-ring-step",
    title: "A normalization step",
    source: "PDF p. 274",
    pdfPage: 274,
    markdown: `For the same curve, take the radical Jacobian test ideal
$$J=\\langle \\bar x,\\bar y(\\bar y-1)\\rangle_A$$
and nonzerodivisor $g=\\bar x$. The quotient $(xJ:J)$ computes data for
$$\\operatorname{Hom}_A(J,J)\\cong \\frac1x(xJ:J),$$
producing an intermediate ring strictly between $A$ and its normalization.`,
    code: `LIB "normal.lib";
ring R = 0,(x,y),dp;
ideal I = x^4+y^2*(y-1)^3;
qring A = std(I);
ideal J = x, y*(y-1);
quotient(x*J, J);`
  },
  {
    id: "normalization",
    title: "Normalization",
    source: "PDF p. 278",
    pdfPage: 278,
    markdown: `Singular's \`normal\` command computes the normalization of the coordinate ring of $x^4+y^2(y-1)^3=0$. The output ideal \`norid\` presents the normalized algebra using auxiliary variables $T(1),T(2)$, and \`normap\` gives the normalization map back to the original curve.

Continuing the normalization computation, \`slocus(norid)\` computes the singular locus of the normalized algebra. The standard basis is $\\langle 1\\rangle$, which means the singular locus is empty and the normalization is smooth.`,
    code: `LIB "normal.lib";
ring R = 0,(x,y),dp;
ideal I = x^4+y^2*(y-1)^3;
list nor = normal(I);
def R1 = nor[1][1];
setring R1;
norid;
normap;
std(slocus(norid));`
  },
]);

export const TUTORIAL_CATEGORIES = Object.freeze([
  {
    id: "chapter-1",
    title: "1. Introduction",
    tutorialIds: Object.freeze([
      "two-ellipses-groebner"
    ])
  },
  {
    id: "chapter-2",
    title: "2. Ideals, Varieties and Standard Bases",
    tutorialIds: Object.freeze([
      "linear-system-standard-basis",
      "monomial-orderings",
      "normal-form-division",
      "reduced-standard-basis",
      "local-division"
    ])
  },
  {
    id: "chapter-3",
    title: "3. Computing with Ideals and Algebraic Sets",
    tutorialIds: Object.freeze([
      "four-points",
      "twisted-cubic-projection",
      "parametrized-surface",
      "whitney-umbrella-kernel",
      "circle-parametrization",
      "nodal-curve",
      "ideal-quotient-basic",
      "quotient-and-elimination",
      "variable-order-effects",
      "projective-closure",
      "saturation-and-rational-normal-curve",
      "degree-five-space-curve",
      "degree-five-plane-curve",
      "highest-corner-jacobian",
      "higher-jacobian-ideal"
    ])
  },
  {
    id: "chapter-5",
    title: "5. Free Resolutions and Invariants",
    tutorialIds: Object.freeze([
      "free-resolutions",
      "hilbert-polynomial",
      "betti-table-twisted-cubic",
      "module-orderings",
      "module-reductions",
      "module-standard-reduction",
      "standard-module-basis",
      "sparse-resolution"
    ])
  },
  {
    id: "chapter-6",
    title: "6. Computing with modules",
    tutorialIds: Object.freeze([
      "syzygy-matrix",
      "module-quotient-modulo"
    ])
  },
  {
    id: "chapter-7",
    title: "7. Primary decomposition",
    tutorialIds: Object.freeze([
      "irreducible-monomial-decomposition",
      "primary-decomposition",
      "embedded-primary-decomposition",
      "radicals-after-quotients"
    ])
  },
  {
    id: "chapter-8",
    title: "8. Normalization",
    tutorialIds: Object.freeze([
      "singular-locus-plane-curve",
      "endomorphism-ring-step",
      "normalization"
    ])
  }
]);
